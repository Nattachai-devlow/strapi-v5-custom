import { createSecureLifecycle } from '../../../../utils/secureFields';

export default createSecureLifecycle('api::student.student', ['studentID', 'phone'], {
  studentID: 5,
  phone: 4,
});