// Tracks whether the server has finished booting (sanitizing the database and
// running its startup tasks). While the server is booting, requests can still
// be served (e.g. to report the booting status to the frontend) but the Spotify
// refresh loop must not run yet.
let ready = false;

export const isServerReady = () => ready;

export const setServerReady = () => {
  ready = true;
};
