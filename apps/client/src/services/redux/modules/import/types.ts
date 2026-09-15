export type ImporterStateStatus =
  | "scheduled"
  | "starting"
  | "progress"
  | "success"
  | "failure"
  | "failure-removed"
  | "cancelled";

export enum ImporterStateType {
  privacy = "privacy",
  fullPrivacy = "full-privacy",
}

export interface BaseImporterState {
  _id: string;
  createdAt: string;
  user: string;
  type: string;
  current: number;
  total: number;
  status: ImporterStateStatus;
  scheduledFor?: string;
}

export interface PrivacyImporterState extends BaseImporterState {
  type: ImporterStateType.privacy;
  metadata: string[];
}

export interface FullPrivacyImporterState extends BaseImporterState {
  type: ImporterStateType.fullPrivacy;
  metadata: string[];
}

export type ImporterState = PrivacyImporterState | FullPrivacyImporterState;
