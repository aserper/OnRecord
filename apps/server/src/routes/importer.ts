import { unlink } from "node:fs/promises";

import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import {
  getImporterState,
  getUserImporterState,
} from "../database/queries/importer";
import {
  canUserImport,
  cancelScheduledImport,
  cleanupImport,
  runImporter,
  scheduleImporter,
} from "../tools/importers/importer";
import { ImporterStateType } from "../tools/importers/types";
import { logger } from "../tools/logger";
import { logged, notAlreadyImporting, validate } from "../tools/middleware";
import { LoggedRequest } from "../tools/types";

export const router = Router();

const upload = multer({
  dest: "/tmp/imports/",
  limits: {
    files: 50,
    fileSize: 1024 * 1024 * 20, // 20 mo
  },
});

const scheduleSchema = z.object({
  scheduledFor: z.string().datetime().optional(),
});

const removeUploadedFiles = (files: Express.Multer.File[]) =>
  Promise.all(files.map((file) => unlink(file.path).catch(() => undefined)));

function getScheduledFor(body: unknown) {
  const { scheduledFor } = validate(body, scheduleSchema);
  return scheduledFor ? new Date(scheduledFor) : null;
}

router.post(
  "/import/privacy",
  logged,
  upload.array("imports", 50),
  async (req, res) => {
    const { files, user } = req as LoggedRequest;
    if (!files || (files as Express.Multer.File[]).length === 0) {
      res.status(400).end();
      return;
    }

    const uploadedFiles = files as Express.Multer.File[];
    const scheduledFor = getScheduledFor(req.body);
    if (scheduledFor && scheduledFor.getTime() <= Date.now()) {
      await removeUploadedFiles(uploadedFiles);
      res.status(400).send({ code: "INVALID_SCHEDULE_TIME" });
      return;
    }
    if (scheduledFor) {
      const scheduled = await scheduleImporter(
        "privacy",
        user._id.toString(),
        uploadedFiles.map((file) => file.path),
        scheduledFor,
      );
      if (!scheduled) {
        res.status(400).send({ code: "IMPORT_INIT_FAILED" });
        return;
      }
      res.status(202).send({ code: "IMPORT_SCHEDULED", id: scheduled._id });
      return;
    }
    if (!canUserImport(user._id.toString())) {
      await removeUploadedFiles(uploadedFiles);
      res.status(400).send({ code: "ALREADY_IMPORTING" });
      return;
    }

    runImporter(
      null,
      "privacy",
      user._id.toString(),
      uploadedFiles.map((file) => file.path),
      (success) => {
        if (success) {
          res.status(200).send({ code: "IMPORT_STARTED" });
          return;
        }
        res.status(400).send({ code: "IMPORT_INIT_FAILED" });
      },
    ).catch(logger.error);
  },
);

router.post(
  "/import/full-privacy",
  logged,
  upload.array("imports", 50),
  async (req, res) => {
    const { files, user } = req as LoggedRequest;
    if (!files || (files as Express.Multer.File[]).length === 0) {
      res.status(400).end();
      return;
    }

    const uploadedFiles = files as Express.Multer.File[];
    const scheduledFor = getScheduledFor(req.body);
    if (scheduledFor && scheduledFor.getTime() <= Date.now()) {
      await removeUploadedFiles(uploadedFiles);
      res.status(400).send({ code: "INVALID_SCHEDULE_TIME" });
      return;
    }
    if (scheduledFor) {
      const scheduled = await scheduleImporter(
        "full-privacy",
        user._id.toString(),
        uploadedFiles.map((file) => file.path),
        scheduledFor,
      );
      if (!scheduled) {
        res.status(400).send({ code: "IMPORT_INIT_FAILED" });
        return;
      }
      res.status(202).send({ code: "IMPORT_SCHEDULED", id: scheduled._id });
      return;
    }
    if (!canUserImport(user._id.toString())) {
      await removeUploadedFiles(uploadedFiles);
      res.status(400).send({ code: "ALREADY_IMPORTING" });
      return;
    }

    runImporter(
      null,
      "full-privacy",
      user._id.toString(),
      uploadedFiles.map((file) => file.path),
      (success) => {
        if (success) {
          res.status(200).send({ code: "IMPORT_STARTED" });
          return;
        }
        res.status(400).send({ code: "IMPORT_INIT_FAILED" });
      },
    ).catch(logger.error);
  },
);

const retrySchema = z.object({ existingStateId: z.string() });

router.post("/import/retry", logged, notAlreadyImporting, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { existingStateId } = validate(req.body, retrySchema);

  const importState =
    await getImporterState<ImporterStateType>(existingStateId);
  if (!importState || importState.user.toString() !== user._id.toString()) {
    res.status(404).end();
    return;
  }

  if (importState.status !== "failure") {
    res.status(400).end();
    return;
  }

  runImporter(
    importState._id.toString(),
    importState.type,
    user._id.toString(),
    importState.metadata,
    (success) => {
      if (success) {
        res.status(200).send({ code: "IMPORT_STARTED" });
        return;
      }
      res.status(400).send({ code: "IMPORT_INIT_FAILED" });
      return;
    },
  ).catch(logger.error);
});

router.delete("/import/schedule/:id", logged, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { id } = validate(req.params, z.object({ id: z.string() }));
  const importState = await getImporterState(id);
  if (!importState || importState.user.toString() !== user._id.toString()) {
    res.status(404).end();
    return;
  }
  if (!(await cancelScheduledImport(id))) {
    res.status(409).send({ code: "IMPORT_ALREADY_STARTED" });
    return;
  }
  res.status(204).end();
});

const cleanupImportSchema = z.object({ id: z.string() });

router.delete("/import/clean/:id", logged, async (req, res) => {
  const { user } = req as LoggedRequest;
  const { id } = validate(req.params, cleanupImportSchema);

  const importState = await getImporterState(id);
  if (!importState) {
    res.status(404).end();
    return;
  }
  if (importState.user.toString() !== user._id.toString()) {
    res.status(404).end();
    return;
  }
  await cleanupImport(importState._id.toString());
  res.status(204).end();
});

router.get("/imports", logged, async (req, res) => {
  const { user } = req as LoggedRequest;

  const state = await getUserImporterState(user._id.toString());
  res.status(200).send(state);
});
