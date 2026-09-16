export {
  operationRoles,
  defaultCashierSettings,
  defaultCashierPermissions,
  normalizeCashierSettings,
  getCashierSettingsForUser,
  selectPersonalStudents,
  mutateOperations,
} from './operationsLegacy.ts';

import { registerOperations as registerLegacyOperations } from './operationsLegacy.ts';
import { registerStudentEnrollment } from './studentEnrollment.ts';

export function registerOperations(app: any, requireAuth: any, getUser: any, getClient: any) {
  registerLegacyOperations(app, requireAuth, getUser, getClient);
  registerStudentEnrollment(app, requireAuth, getUser, getClient);
}
