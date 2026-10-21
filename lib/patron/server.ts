import "server-only";
import { authorizeSharedAdmin } from "../admin/test-server";
import { patronConfig, patronEnabled } from "./config";
import { patronHandlers } from "./http";
import { getPatronStore } from "./store";

export const patronApi = patronHandlers({
  enabled: patronEnabled, config: patronConfig, authorize: authorizeSharedAdmin, store: getPatronStore,
});
