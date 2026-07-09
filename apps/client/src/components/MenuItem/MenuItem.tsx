import { MenuItem as MuiMenuItem } from "@mui/material";
import { ReactNode } from "react";

import s from "./index.module.css";

interface MenuItemProps {
  children: ReactNode;
  onClick: () => void;
}

export function MenuItem({ children, onClick }: MenuItemProps) {
  return (
    <MuiMenuItem className={s.root} onClick={onClick}>
      {children}
    </MuiMenuItem>
  );
}
