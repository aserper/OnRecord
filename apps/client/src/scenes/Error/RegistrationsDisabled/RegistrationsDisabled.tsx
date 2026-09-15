import Text from "../../../components/Text";

import s from "../index.module.css";

export default function RegistrationsDisabled() {
  return (
    <div className={s.root}>
      <Text element="h1" size="pagetitle">
        Registration disabled
      </Text>
      <Text className={s.explain} size="normal">
        New accounts cannot be created. Ask an administrator to enable
        registration.
      </Text>
    </div>
  );
}
