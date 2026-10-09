import { createSecureLifecycle } from '../../../../utils/secureFields';

export default createSecureLifecycle('api::teacher.teacher', ['phone'], {
  phone: 4,
});