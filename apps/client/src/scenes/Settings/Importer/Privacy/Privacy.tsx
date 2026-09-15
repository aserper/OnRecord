import { ImporterStateType } from "../../../../services/redux/modules/import/types";
import ImportUploadForm from "../ImportUploadForm";

export default function Privacy() {
  return (
    <ImportUploadForm
      type={ImporterStateType.privacy}
      expectedPrefix="StreamingHistory">
      Import the standard account-data export from Spotify. Request it from the{" "}
      <a
        target="_blank"
        href="https://www.spotify.com/us/account/privacy/"
        rel="noreferrer">
        Spotify privacy page
      </a>
      , then select every <code>StreamingHistory</code> JSON file from the
      download.
    </ImportUploadForm>
  );
}
