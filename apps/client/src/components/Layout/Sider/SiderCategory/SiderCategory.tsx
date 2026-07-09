import clsx from "clsx";
import { useContext } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { Link } from "react-router-dom";

import { User } from "../../../../services/redux/modules/user/types";
import Text from "../../../Text";
import { LayoutContext } from "../../LayoutContext";
import { SiderCategory as SiderCategoryType } from "../types";

import s from "./index.module.css";

interface SiderCategoryProps {
  category: SiderCategoryType;
  toCopy: string;
  onCopy: () => void;
  pathname: string;
  user: User;
}

export default function SiderCategory({
  category,
  toCopy,
  onCopy,
  pathname,
  user,
}: SiderCategoryProps) {
  const layoutContext = useContext(LayoutContext);

  const links = category.items.filter(
    (item) => !item.restrict || (item.restrict === "guest" && !user.isGuest),
  );

  if (links.length === 0) {
    return null;
  }

  return (
    <div className={s.category} key={category.label}>
      <Text element="div" onDark className={s.categoryname} size="small">
        {category.label}
      </Text>
      {toCopy &&
        links.map((link) => {
          const active = pathname === link.link;
          if (link.link === "/share") {
            return (
              <CopyToClipboard key={link.label} onCopy={onCopy} text={toCopy}>
                <div className={s.link} key={link.label}>
                  <Text
                    size="normal"
                    onDark
                    className={clsx(s.linkcontent, { [s.active]: active })}>
                    {active ? link.iconOn : link.icon}
                    {link.label}
                  </Text>
                </div>
              </CopyToClipboard>
            );
          }
          return (
            <Link
              to={link.link}
              className={s.link}
              key={link.label}
              onClick={layoutContext.closeDrawer}>
              <Text
                size="normal"
                onDark
                element="div"
                className={clsx(s.linkcontent, { [s.active]: active })}>
                {active ? link.iconOn : link.icon}
                {link.label}
              </Text>
            </Link>
          );
        })}
    </div>
  );
}
