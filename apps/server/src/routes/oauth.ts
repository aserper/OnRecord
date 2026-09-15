import { Request, Response, Router } from "express";
import { sign } from "jsonwebtoken";
import { z } from "zod";

import {
  createUser,
  getUserCount,
  getUserFromField,
  storeInUser,
} from "../database";
import { getPrivateData } from "../database/queries/privateData";
import {
  SpotifyRateLimitError,
  spotifyRateLimitState,
} from "../tools/apis/rateLimitState";
import { SpotifyMe } from "../tools/apis/spotifyApi";
import { get, getWithDefault } from "../tools/env";
import { logger } from "../tools/logger";
import {
  logged,
  validate,
  withGlobalPreferences,
  withHttpClient,
} from "../tools/middleware";
import { spotifyProvider } from "../tools/oauth/Provider";
import { GlobalPreferencesRequest, SpotifyRequest } from "../tools/types";

export const router = Router();

function storeTokenInCookie(
  request: Request,
  response: Response,
  token: string,
) {
  response.cookie("token", token, {
    sameSite: "strict",
    httpOnly: true,
    secure: request.secure,
  });
}

const OAUTH_COOKIE_NAME = "oauth";
const spotifyCallbackOAuthCookie = z.object({ state: z.string() });
type OAuthCookie = z.infer<typeof spotifyCallbackOAuthCookie>;

function respondIfSpotifyIsCoolingDown(res: Response) {
  const remainingMs = spotifyRateLimitState.getRemainingMs();
  if (remainingMs <= 0) {
    return false;
  }

  const deadline = new Date(spotifyRateLimitState.getDeadline()).toISOString();
  res
    .status(503)
    .set("Retry-After", String(Math.ceil(remainingMs / 1000)))
    .set("Cache-Control", "no-store")
    .type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Spotify temporarily unavailable</title>
  </head>
  <body style="font: 18px system-ui; max-width: 42rem; margin: 10vh auto; padding: 1.5rem; background: #101827; color: #f0eee7">
    <main>
      <p style="color: #e56b45; font-weight: 700">YOUR SPOTIFY</p>
      <h1>Spotify asked us to pause.</h1>
      <p>This application is honoring a recorded rate-limit cooldown until <strong>${deadline}</strong> (UTC).</p>
      <p>Your listening history and uploaded import files are safe. Repeated login attempts cannot shorten the wait.</p>
      <p>Please begin a fresh sign-in after that time rather than refreshing an old callback.</p>
      <a style="color: #f0a080" href="${get("CLIENT_ENDPOINT")}/login">Back to login</a>
    </main>
  </body>
</html>`);
  return true;
}

function safeErrorMessage(error: unknown) {
  if (error instanceof SpotifyRateLimitError) {
    return error.code;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown OAuth error";
}

router.get("/spotify", async (req, res) => {
  const isOffline = get("OFFLINE_DEV_ID");
  if (isOffline) {
    const privateData = await getPrivateData();
    if (!privateData?.jwtPrivateKey) {
      throw new Error("No private data found, cannot sign JWT");
    }
    const token = sign({ userId: isOffline }, privateData.jwtPrivateKey, {
      expiresIn: getWithDefault("COOKIE_VALIDITY_MS", "1h") as `${number}`,
    });
    storeTokenInCookie(req, res, token);
    res.status(204).end();
    return;
  }
  if (respondIfSpotifyIsCoolingDown(res)) {
    return;
  }
  const { url, state } = await spotifyProvider.getRedirect();
  const oauthCookie: OAuthCookie = { state };

  res.cookie(OAUTH_COOKIE_NAME, oauthCookie, {
    sameSite: "lax",
    httpOnly: true,
    secure: req.secure,
  });

  res.redirect(url);
});

const spotifyCallback = z.object({ code: z.string(), state: z.string() });

router.get("/spotify/callback", withGlobalPreferences, async (req, res) => {
  if (respondIfSpotifyIsCoolingDown(res)) {
    return;
  }
  const { query, globalPreferences } = req as GlobalPreferencesRequest;
  const { code, state } = validate(query, spotifyCallback);

  try {
    const cookie = spotifyCallbackOAuthCookie.parse(
      req.cookies[OAUTH_COOKIE_NAME],
    );

    if (state !== cookie.state) {
      throw new Error("State does not match");
    }

    const infos = await spotifyProvider.exchangeCode(code, cookie.state);

    const client = spotifyProvider.getHttpClient(infos.accessToken);
    const { data: spotifyMe } = await client.get<SpotifyMe>("/me", {
      priority: "high",
      failFastOnRateLimit: true,
    });
    let user = await getUserFromField("spotifyId", spotifyMe.id, false);
    if (!user) {
      if (!globalPreferences.allowRegistrations) {
        return res.redirect(`${get("CLIENT_ENDPOINT")}/registrations-disabled`);
      }
      const nbUsers = await getUserCount();
      user = await createUser(
        spotifyMe.display_name,
        spotifyMe.id,
        nbUsers === 0,
      );
    }
    await storeInUser("_id", user._id, infos);
    const privateData = await getPrivateData();
    if (!privateData?.jwtPrivateKey) {
      throw new Error("No private data found, cannot sign JWT");
    }
    const token = sign(
      { userId: user._id.toString() },
      privateData.jwtPrivateKey,
      { expiresIn: getWithDefault("COOKIE_VALIDITY_MS", "1h") as `${number}` },
    );
    storeTokenInCookie(req, res, token);
  } catch (e) {
    if (
      e instanceof SpotifyRateLimitError &&
      respondIfSpotifyIsCoolingDown(res)
    ) {
      return;
    }
    logger.error("Spotify OAuth failed: %s", safeErrorMessage(e));
  } finally {
    res.clearCookie(OAUTH_COOKIE_NAME);
  }
  return res.redirect(get("CLIENT_ENDPOINT"));
});

router.get("/spotify/me", logged, withHttpClient, async (req, res) => {
  const { client } = req as SpotifyRequest;

  try {
    const me = await client.me();
    res.status(200).send(me);
  } catch (e) {
    if (e instanceof SpotifyRateLimitError) {
      res
        .status(503)
        .set(
          "Retry-After",
          String(Math.max(1, Math.ceil((e.retryAt - Date.now()) / 1000))),
        )
        .send({ code: e.code, retryAt: e.retryAt });
      return;
    }
    logger.error(safeErrorMessage(e));
    res.status(500).send({ code: "SPOTIFY_ERROR" });
  }
});
