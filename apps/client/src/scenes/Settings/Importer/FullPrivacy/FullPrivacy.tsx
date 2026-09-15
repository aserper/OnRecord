import { ImporterStateType } from "../../../../services/redux/modules/import/types";
import ImportUploadForm from "../ImportUploadForm";

export default function FullPrivacy() {
  return (
    <ImportUploadForm
      type={ImporterStateType.fullPrivacy}
      expectedPrefix="Streaming_History_Audio">
      Import the extended streaming-history export requested from the{" "}
      <a
        target="_blank"
        href="https://www.spotify.com/account/privacy/"
        rel="noreferrer">
        Spotify privacy page
      </a>
      . Select every <code>Streaming_History_Audio</code> JSON file from the
      download.
    </ImportUploadForm>
  );
}
