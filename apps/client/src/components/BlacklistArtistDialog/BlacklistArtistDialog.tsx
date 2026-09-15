import { Dialog, DialogContent, Button } from "@mui/material";

import {
  blacklistArtist,
  unblacklistArtist,
} from "../../services/redux/modules/user/thunk";
import { useAppDispatch } from "../../services/redux/tools";
import SimpleDialogContent from "../SimpleDialogContent";

interface BlacklistArtistDialogProps {
  artistId?: string;
  artistName?: string;
  blacklisted: boolean;
  onClose?: () => void;
}

export default function BlacklistArtistDialog({
  artistId,
  artistName,
  blacklisted,
  onClose,
}: BlacklistArtistDialogProps) {
  const dispatch = useAppDispatch();

  const doBlacklist = async () => {
    if (!artistId) {
      return;
    }
    await dispatch(blacklistArtist(artistId));
    onClose?.();
  };

  const doUnblacklist = async () => {
    if (!artistId) {
      return undefined;
    }
    await dispatch(unblacklistArtist(artistId));
    onClose?.();
  };

  return (
    <>
      <Dialog
        title="Exclude artist"
        open={Boolean(artistId) && !blacklisted}
        onClose={onClose}>
        <DialogContent>
          <SimpleDialogContent
            message={`Hide recorded plays by ${artistName} from statistics and listening history. No plays are deleted. You can include this artist again at any time.`}
            actions={
              <Button variant="contained" color="error" onClick={doBlacklist}>
                Exclude artist
              </Button>
            }
          />
        </DialogContent>
      </Dialog>
      <Dialog
        title="Include artist"
        open={Boolean(artistId) && blacklisted}
        onClose={onClose}>
        <DialogContent>
          <SimpleDialogContent
            message={`Show recorded plays by ${artistName} in statistics and listening history again.`}
            actions={
              <Button variant="contained" color="error" onClick={doUnblacklist}>
                Include artist
              </Button>
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
