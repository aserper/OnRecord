import Text from "../../../components/Text";
import { getApiEndpoint } from "../../../services/tools";

import s from "../index.module.css";

export default function ApiEndpointSetToFrontend() {
  return (
    <div className={s.root}>
      <Text element="h1" size="pagetitle">
        API configuration error
      </Text>
      <Text className={s.explain} size="normal">
        The request reached the frontend instead of the API server.
        <p />
        Ask an administrator to check that <code>API_ENDPOINT</code> points to
        the API server.
        <p />
        Current configuration: <br />
        <code>API_ENDPOINT={getApiEndpoint()}</code>
      </Text>
    </div>
  );
}
