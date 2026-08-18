import { pgTable, serial, text, integer, timestamp, boolean, doublePrecision, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const schools = pgTable('schools', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  identifier: text('identifier'), // e.g. EDUCO-SCH-8492
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  logo: text('logo'),
  creationDate: text('creation_date'),
  promoterName: text('promoter_name'),
  promoterContact: text('promoter_contact'),
  promoterEmail: text('promoter_email'),
  levels: jsonb('levels').default({}),
  openingAuthorizationDoc: text('opening_authorization_doc'),
  promoterIdDoc: text('promoter_id_doc'),
  statutesDoc: text('statutes_doc'),
  status: text('status').default('active'),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').defaultNow(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Supabase / User UID
  schoolId: integer('school_id').references(() => schools.id),
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull(), // Admin, Co-admin, Teacher, Cashier, Finance Manager, Promoter, Student, DE, Parent
  avatar: text('avatar'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  schoolId: integer('school_id').references(() => schools.id),
  studentId: text('student_id').unique(),
  classId: integer('class_id'),
  parentName: text('parent_name'),
  parentPhone: text('parent_phone'),
  address: text('address'),
  dateOfBirth: text('date_of_birth'),
  enrollmentDate: text('enrollment_date'),
  status: text('status').default('active'),
});

export const classes = pgTable('classes', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').references(() => schools.id),
  name: text('name').notNull(),
  level: text('level'),
  capacity: integer('capacity'),
  teacherId: integer('teacher_id').references(() => users.id),
});

export const fees = pgTable('fees', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').references(() => schools.id),
  name: text('name').notNull(),
  amount: doublePrecision('amount').notNull(),
  dueDate: text('due_date'),
  type: text('type'), // registration, tuition, exam, etc.
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').references(() => schools.id),
  studentId: integer('student_id').references(() => students.id),
  feeId: integer('fee_id').references(() => fees.id),
  amount: doublePrecision('amount').notNull(),
  paymentDate: timestamp('payment_date').defaultNow(),
  receiptNumber: text('receipt_number').unique(),
  paymentMethod: text('payment_method'),
  status: text('status').default('paid'),
});

export const personnel = pgTable('personnel', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  schoolId: integer('school_id').references(() => schools.id),
  matricule: text('matricule'),
  role: text('role'),
  baseSalary: doublePrecision('base_salary'),
  hireDate: text('hire_date'),
  bankAccount: text('bank_account'),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').references(() => schools.id),
  type: text('type').notNull(), // income, expense
  category: text('category'),
  amount: doublePrecision('amount').notNull(),
  description: text('description'),
  date: timestamp('date').defaultNow(),
  recordedBy: integer('recorded_by').references(() => users.id),
});

export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').references(() => schools.id),
  name: text('name').notNull(),
  coefficient: integer('coefficient').default(1),
});

export const grades = pgTable('grades', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').references(() => students.id),
  subjectId: integer('subject_id').references(() => subjects.id),
  classId: integer('class_id').references(() => classes.id),
  score: doublePrecision('score').notNull(),
  maxScore: doublePrecision('max_score').default(20),
  term: text('term'), // Trimestre 1, etc.
  date: timestamp('date').defaultNow(),
  teacherId: integer('teacher_id').references(() => users.id),
});

export const attendance = pgTable('attendance', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').references(() => students.id),
  classId: integer('class_id').references(() => classes.id),
  status: text('status').notNull(), // present, absent, late
  date: text('date').notNull(),
  recordedBy: integer('recorded_by').references(() => users.id),
});

export const timetable = pgTable('timetable', {
  id: serial('id').primaryKey(),
  classId: integer('class_id').references(() => classes.id),
  subjectId: integer('subject_id').references(() => subjects.id),
  teacherId: integer('teacher_id').references(() => users.id),
  dayOfWeek: text('day_of_week').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  room: text('room'),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  notifId: text('notif_id').$defaultFn(() => `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`),
  userId: integer('user_id').references(() => users.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // e.g. EDUCO-STD-2026-X8F9-Q2M1 or EDUCO-AI-2026-Y4K8-V7B3
  schoolId: integer('school_id').references(() => schools.id),
  schoolName: text('school_name').notNull(),
  schoolIdentifier: text('school_identifier').notNull(),
  promoterName: text('promoter_name').notNull(),
  promoterContact: text('promoter_contact'),
  planType: text('plan_type').notNull(), // 'standard' (10 000 FCFA/mois) or 'ai_premium' (20 000 FCFA/mois)
  amountPaid: doublePrecision('amount_paid').notNull(),
  months: integer('months').notNull().default(1),
  status: text('status').notNull().default('active'), // 'pending', 'active', 'expired', 'revoked'
  startDate: timestamp('start_date').defaultNow(),
  endDate: timestamp('end_date').notNull(),
  autoRenew: boolean('auto_renew').default(false),
  autoRenewFrequency: text('auto_renew_frequency').default('before_expiry'), // 'monthly', 'before_expiry'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const subscriptionRequests = pgTable('subscription_requests', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').references(() => schools.id),
  schoolIdentifier: text('school_identifier').notNull(),
  schoolName: text('school_name').notNull(),
  promoterName: text('promoter_name').notNull(),
  promoterContact: text('promoter_contact'),
  requestedPlan: text('requested_plan').notNull(), // 'standard' | 'ai_premium'
  requestedMonths: integer('requested_months').notNull().default(1),
  status: text('status').notNull().default('pending'), // 'pending', 'processed', 'cancelled'
  createdAt: timestamp('created_at').defaultNow(),
});

export const surveys = pgTable('surveys', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id').references(() => schools.id),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').notNull().default('Général'), // 'Activités parascolaires', 'Journées portes ouvertes', 'Restauration', 'Sorties pédagogiques', etc.
  targetAudience: text('target_audience').default('all'), // 'all', 'maternelle', 'primaire', 'college', 'lycee', etc.
  deadline: timestamp('deadline'),
  status: text('status').notNull().default('active'), // 'active', 'closed'
  questions: jsonb('questions').notNull().default([]), // array of { id, text, type, options }
  creatorName: text('creator_name'),
  creatorRole: text('creator_role'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const surveyResponses = pgTable('survey_responses', {
  id: serial('id').primaryKey(),
  surveyId: integer('survey_id').references(() => surveys.id),
  parentName: text('parent_name').notNull(),
  parentPhone: text('parent_phone'),
  parentEmail: text('parent_email'),
  studentName: text('student_name'),
  studentClass: text('student_class'),
  channel: text('channel').default('whatsapp'), // 'whatsapp', 'email', 'in_person', 'portal'
  answers: jsonb('answers').notNull().default({}), // { [questionId]: answer }
  comment: text('comment'),
  submittedAt: timestamp('submitted_at').defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  schoolId: integer('school_id'),
  schoolName: text('school_name'),
  userName: text('user_name'),
  userRole: text('user_role'),
  userEmail: text('user_email'),
  action: text('action').notNull(),
  details: text('details'),
  ipAddress: text('ip_address'),
  location: text('location'),
  device: text('device'),
  browser: text('browser'),
  page: text('page'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const webauthnCredentials = pgTable('webauthn_credentials', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(), // User UID or email
  userEmail: text('user_email').notNull(),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').default(0),
  deviceName: text('device_name'),
  deviceType: text('device_type'),
  transports: jsonb('transports').default([]),
  createdAt: timestamp('created_at').defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
  revokedAt: timestamp('revoked_at'),
});

// Relations
export const schoolsRelations = relations(schools, ({ many }) => ({
  users: many(users),
  classes: many(classes),
  students: many(students),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  school: one(schools, {
    fields: [users.schoolId],
    references: [schools.id],
  }),
  student: one(students, {
    fields: [users.id],
    references: [students.userId],
  }),
  personnel: one(personnel, {
    fields: [users.id],
    references: [personnel.userId],
  }),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  school: one(schools, {
    fields: [students.schoolId],
    references: [schools.id],
  }),
  payments: many(payments),
  grades: many(grades),
  attendance: many(attendance),
}));
