import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const resetPool = (newConnectionString?: string) => {
  if (global._postgresPool) {
    try {
      global._postgresPool.end();
    } catch (e) {}
    global._postgresPool = undefined;
  }
  if (newConnectionString) {
    process.env.DATABASE_URL = newConnectionString;
    process.env.SUPABASE_DB_URL = newConnectionString;
  }
  return createPool();
};

export const isDbConfigured = (): boolean => {
  const connectionString = (
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.SUPABASE_DB_URL || 
    process.env.SUPABASE_DATABASE_URL || 
    ''
  ).trim();

  if (!connectionString && !process.env.SQL_HOST) {
    return false;
  }

  if (
    connectionString.includes('placeholder') || 
    connectionString.includes('your_') || 
    connectionString.includes('your-') ||
    connectionString.includes('your-password') ||
    connectionString.includes('your-project') ||
    connectionString.includes('change_me') ||
    connectionString.includes('example.com')
  ) {
    return false;
  }

  return true;
};

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString = process.env.DATABASE_URL || 
                             process.env.POSTGRES_URL || 
                             process.env.SUPABASE_DB_URL || 
                             process.env.SUPABASE_DATABASE_URL;

    if (connectionString) {
      const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
      const disableSsl = connectionString.includes('sslmode=disable') || connectionString.includes('ssl=false');
      const ssl = (isLocalhost || disableSsl) ? false : { rejectUnauthorized: false };

      global._postgresPool = new Pool({
        connectionString,
        ssl,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    } else if (process.env.SQL_HOST) {
      const isLocalhost = process.env.SQL_HOST.includes('localhost') || process.env.SQL_HOST.includes('127.0.0.1');
      const disableSsl = process.env.SQL_HOST.includes('sslmode=disable');
      const ssl = (isLocalhost || disableSsl) ? false : { rejectUnauthorized: false };

      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME || 'postgres',
        port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT) : 5432,
        ssl,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    } else {
      global._postgresPool = new Pool({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: '',
        database: 'postgres',
        ssl: false,
        connectionTimeoutMillis: 1000,
      });
    }

    global._postgresPool.on('error', (err: any) => {
      if (err?.message?.includes('does not support SSL connections')) {
        console.warn('🔄 Switching PostgreSQL pool to non-SSL mode...');
        resetPool();
      }
    });
  }
  return global._postgresPool;
};

export const ensureSchemaColumns = async () => {
  if (!isDbConfigured()) {
    return;
  }
  try {
    const pool = createPool();
    const statements = [
      `CREATE TABLE IF NOT EXISTS schools (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        identifier TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        logo TEXT,
        creation_date TEXT,
        promoter_name TEXT,
        promoter_contact TEXT,
        promoter_email TEXT,
        levels JSONB DEFAULT '{}'::jsonb,
        opening_authorization_doc TEXT,
        promoter_id_doc TEXT,
        statutes_doc TEXT,
        status TEXT DEFAULT 'active',
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        school_id INTEGER REFERENCES schools(id),
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        avatar TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        school_id INTEGER REFERENCES schools(id),
        student_id TEXT UNIQUE,
        class_id INTEGER,
        parent_name TEXT,
        parent_phone TEXT,
        address TEXT,
        date_of_birth TEXT,
        enrollment_date TEXT,
        status TEXT DEFAULT 'active'
      );`,
      `CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        school_id INTEGER REFERENCES schools(id),
        name TEXT NOT NULL,
        level TEXT,
        capacity INTEGER,
        teacher_id INTEGER REFERENCES users(id)
      );`,
      `CREATE TABLE IF NOT EXISTS fees (
        id SERIAL PRIMARY KEY,
        school_id INTEGER REFERENCES schools(id),
        name TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        due_date TEXT,
        type TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        school_id INTEGER REFERENCES schools(id),
        student_id INTEGER REFERENCES students(id),
        fee_id INTEGER REFERENCES fees(id),
        amount DOUBLE PRECISION NOT NULL,
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        receipt_number TEXT UNIQUE,
        payment_method TEXT,
        status TEXT DEFAULT 'paid'
      );`,
      `CREATE TABLE IF NOT EXISTS personnel (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        school_id INTEGER REFERENCES schools(id),
        matricule TEXT,
        role TEXT,
        base_salary DOUBLE PRECISION,
        hire_date TEXT,
        bank_account TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        school_id INTEGER REFERENCES schools(id),
        type TEXT NOT NULL,
        category TEXT,
        amount DOUBLE PRECISION NOT NULL,
        description TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        recorded_by INTEGER REFERENCES users(id)
      );`,
      `CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        school_id INTEGER REFERENCES schools(id),
        name TEXT NOT NULL,
        coefficient INTEGER DEFAULT 1
      );`,
      `CREATE TABLE IF NOT EXISTS grades (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        subject_id INTEGER REFERENCES subjects(id),
        class_id INTEGER REFERENCES classes(id),
        score DOUBLE PRECISION NOT NULL,
        max_score DOUBLE PRECISION DEFAULT 20,
        term TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        teacher_id INTEGER REFERENCES users(id)
      );`,
      `CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        class_id INTEGER REFERENCES classes(id),
        status TEXT NOT NULL,
        date TEXT NOT NULL,
        recorded_by INTEGER REFERENCES users(id)
      );`,
      `CREATE TABLE IF NOT EXISTS timetable (
        id SERIAL PRIMARY KEY,
        class_id INTEGER REFERENCES classes(id),
        subject_id INTEGER REFERENCES subjects(id),
        teacher_id INTEGER REFERENCES users(id),
        day_of_week TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        room TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        school_id INTEGER REFERENCES schools(id),
        school_name TEXT NOT NULL,
        school_identifier TEXT NOT NULL,
        promoter_name TEXT NOT NULL,
        promoter_contact TEXT,
        plan_type TEXT NOT NULL,
        amount_paid DOUBLE PRECISION NOT NULL,
        months INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP NOT NULL,
        auto_renew BOOLEAN DEFAULT false,
        auto_renew_frequency TEXT DEFAULT 'before_expiry',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS subscription_requests (
        id SERIAL PRIMARY KEY,
        school_id INTEGER REFERENCES schools(id),
        school_identifier TEXT NOT NULL,
        school_name TEXT NOT NULL,
        promoter_name TEXT NOT NULL,
        promoter_contact TEXT,
        requested_plan TEXT NOT NULL,
        requested_months INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS surveys (
        id SERIAL PRIMARY KEY,
        school_id INTEGER REFERENCES schools(id),
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL DEFAULT 'Général',
        target_audience TEXT DEFAULT 'all',
        deadline TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'active',
        questions JSONB NOT NULL DEFAULT '[]'::jsonb,
        creator_name TEXT,
        creator_role TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS survey_responses (
        id SERIAL PRIMARY KEY,
        survey_id INTEGER REFERENCES surveys(id),
        parent_name TEXT NOT NULL,
        parent_phone TEXT,
        parent_email TEXT,
        student_name TEXT,
        student_class TEXT,
        channel TEXT DEFAULT 'whatsapp',
        answers JSONB NOT NULL DEFAULT '{}'::jsonb,
        comment TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        school_id INTEGER,
        school_name TEXT,
        user_name TEXT,
        user_role TEXT,
        user_email TEXT,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        location TEXT,
        device TEXT,
        browser TEXT,
        page TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS identifier TEXT;`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS address TEXT;`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS phone TEXT;`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS email TEXT;`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo TEXT;`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS creation_date TEXT;`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS promoter_name TEXT;`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS promoter_contact TEXT;`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS promoter_email TEXT;`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS levels JSONB DEFAULT '{}'::jsonb;`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS opening_authorization_doc TEXT;`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS promoter_id_doc TEXT;`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS statutes_doc TEXT;`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;`,
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,
      
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS uid TEXT;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id INTEGER;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,

      `ALTER TABLE classes ADD COLUMN IF NOT EXISTS school_id INTEGER;`,
      `ALTER TABLE classes ADD COLUMN IF NOT EXISTS name TEXT;`,
      `ALTER TABLE classes ADD COLUMN IF NOT EXISTS level TEXT;`,
      `ALTER TABLE classes ADD COLUMN IF NOT EXISTS capacity INTEGER;`,
      `ALTER TABLE classes ADD COLUMN IF NOT EXISTS teacher_id INTEGER;`,

      `ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id INTEGER;`,
      `ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id INTEGER;`,
      `ALTER TABLE students ADD COLUMN IF NOT EXISTS student_id TEXT;`,
      `ALTER TABLE students ADD COLUMN IF NOT EXISTS class_id INTEGER;`,
      `ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_name TEXT;`,
      `ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_phone TEXT;`,
      `ALTER TABLE students ADD COLUMN IF NOT EXISTS address TEXT;`,
      `ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth TEXT;`,
      `ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_date TEXT;`,
      `ALTER TABLE students ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`,

      `ALTER TABLE fees ADD COLUMN IF NOT EXISTS school_id INTEGER;`,
      `ALTER TABLE fees ADD COLUMN IF NOT EXISTS name TEXT;`,
      `ALTER TABLE fees ADD COLUMN IF NOT EXISTS amount DOUBLE PRECISION;`,
      `ALTER TABLE fees ADD COLUMN IF NOT EXISTS due_date TEXT;`,
      `ALTER TABLE fees ADD COLUMN IF NOT EXISTS type TEXT;`,

      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS school_id INTEGER;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS student_id INTEGER;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS fee_id INTEGER;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount DOUBLE PRECISION;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_number TEXT;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method TEXT;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'paid';`,

      `ALTER TABLE personnel ADD COLUMN IF NOT EXISTS user_id INTEGER;`,
      `ALTER TABLE personnel ADD COLUMN IF NOT EXISTS school_id INTEGER;`,
      `ALTER TABLE personnel ADD COLUMN IF NOT EXISTS matricule TEXT;`,
      `ALTER TABLE personnel ADD COLUMN IF NOT EXISTS role TEXT;`,
      `ALTER TABLE personnel ADD COLUMN IF NOT EXISTS base_salary DOUBLE PRECISION;`,
      `ALTER TABLE personnel ADD COLUMN IF NOT EXISTS hire_date TEXT;`,
      `ALTER TABLE personnel ADD COLUMN IF NOT EXISTS bank_account TEXT;`,

      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS school_id INTEGER;`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS type TEXT;`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category TEXT;`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount DOUBLE PRECISION;`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description TEXT;`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recorded_by INTEGER;`,

      `ALTER TABLE subjects ADD COLUMN IF NOT EXISTS school_id INTEGER;`,
      `ALTER TABLE subjects ADD COLUMN IF NOT EXISTS name TEXT;`,
      `ALTER TABLE subjects ADD COLUMN IF NOT EXISTS coefficient INTEGER DEFAULT 1;`,

      `ALTER TABLE grades ADD COLUMN IF NOT EXISTS student_id INTEGER;`,
      `ALTER TABLE grades ADD COLUMN IF NOT EXISTS subject_id INTEGER;`,
      `ALTER TABLE grades ADD COLUMN IF NOT EXISTS class_id INTEGER;`,
      `ALTER TABLE grades ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION;`,
      `ALTER TABLE grades ADD COLUMN IF NOT EXISTS max_score DOUBLE PRECISION DEFAULT 20;`,
      `ALTER TABLE grades ADD COLUMN IF NOT EXISTS term TEXT;`,
      `ALTER TABLE grades ADD COLUMN IF NOT EXISTS date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,
      `ALTER TABLE grades ADD COLUMN IF NOT EXISTS teacher_id INTEGER;`,

      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS student_id INTEGER;`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS class_id INTEGER;`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS status TEXT;`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS date TEXT;`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS recorded_by INTEGER;`,

      `ALTER TABLE timetable ADD COLUMN IF NOT EXISTS class_id INTEGER;`,
      `ALTER TABLE timetable ADD COLUMN IF NOT EXISTS subject_id INTEGER;`,
      `ALTER TABLE timetable ADD COLUMN IF NOT EXISTS teacher_id INTEGER;`,
      `ALTER TABLE timetable ADD COLUMN IF NOT EXISTS day_of_week TEXT;`,
      `ALTER TABLE timetable ADD COLUMN IF NOT EXISTS start_time TEXT;`,
      `ALTER TABLE timetable ADD COLUMN IF NOT EXISTS end_time TEXT;`,
      `ALTER TABLE timetable ADD COLUMN IF NOT EXISTS room TEXT;`,

      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id INTEGER;`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT;`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,

      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS code TEXT;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS school_id INTEGER;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS school_name TEXT;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS school_identifier TEXT;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS promoter_name TEXT;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS promoter_contact TEXT;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_type TEXT;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount_paid DOUBLE PRECISION;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS months INTEGER DEFAULT 1;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew_frequency TEXT DEFAULT 'before_expiry';`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,

      `ALTER TABLE subscription_requests ADD COLUMN IF NOT EXISTS school_id INTEGER;`,
      `ALTER TABLE subscription_requests ADD COLUMN IF NOT EXISTS school_identifier TEXT;`,
      `ALTER TABLE subscription_requests ADD COLUMN IF NOT EXISTS school_name TEXT;`,
      `ALTER TABLE subscription_requests ADD COLUMN IF NOT EXISTS promoter_name TEXT;`,
      `ALTER TABLE subscription_requests ADD COLUMN IF NOT EXISTS promoter_contact TEXT;`,
      `ALTER TABLE subscription_requests ADD COLUMN IF NOT EXISTS requested_plan TEXT;`,
      `ALTER TABLE subscription_requests ADD COLUMN IF NOT EXISTS requested_months INTEGER DEFAULT 1;`,
      `ALTER TABLE subscription_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';`,
      `ALTER TABLE subscription_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,

      `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS school_id INTEGER;`,
      `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS title TEXT;`,
      `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS description TEXT;`,
      `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Général';`,
      `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'all';`,
      `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS deadline TIMESTAMP;`,
      `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`,
      `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '[]'::jsonb;`,
      `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS creator_name TEXT;`,
      `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS creator_role TEXT;`,
      `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,

      `ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS survey_id INTEGER;`,
      `ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS parent_name TEXT;`,
      `ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS parent_phone TEXT;`,
      `ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS parent_email TEXT;`,
      `ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS student_name TEXT;`,
      `ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS student_class TEXT;`,
      `ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'whatsapp';`,
      `ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '{}'::jsonb;`,
      `ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS comment TEXT;`,
      `ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,

      `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS school_id INTEGER;`,
      `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS school_name TEXT;`,
      `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_name TEXT;`,
      `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_role TEXT;`,
      `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_email TEXT;`,
      `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS action TEXT;`,
      `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS details TEXT;`,
      `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;`,
      `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS location TEXT;`,
      `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS device TEXT;`,
      `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS browser TEXT;`,
      `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS page TEXT;`,
      `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,

      // Relax legacy NOT NULL constraints safely if columns exist
      `DO $$ 
      BEGIN 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='notif_id') THEN 
          ALTER TABLE notifications ALTER COLUMN notif_id DROP NOT NULL; 
          ALTER TABLE notifications ALTER COLUMN notif_id SET DEFAULT NULL;
        END IF; 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='timestamp') THEN 
          ALTER TABLE notifications ALTER COLUMN timestamp DROP NOT NULL; 
        END IF; 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='roles') THEN 
          ALTER TABLE notifications ALTER COLUMN roles DROP NOT NULL; 
        END IF; 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='read') THEN 
          ALTER TABLE notifications ALTER COLUMN read DROP NOT NULL; 
        END IF; 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='student_name') THEN 
          ALTER TABLE payments ALTER COLUMN student_name DROP NOT NULL; 
        END IF; 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='class_name') THEN 
          ALTER TABLE payments ALTER COLUMN class_name DROP NOT NULL; 
        END IF; 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='fee_type') THEN 
          ALTER TABLE payments ALTER COLUMN fee_type DROP NOT NULL; 
        END IF; 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fees' AND column_name='class_name') THEN 
          ALTER TABLE fees ALTER COLUMN class_name DROP NOT NULL; 
        END IF; 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fees' AND column_name='fee_type') THEN 
          ALTER TABLE fees ALTER COLUMN fee_type DROP NOT NULL; 
        END IF; 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='txn_id') THEN 
          ALTER TABLE transactions ALTER COLUMN txn_id DROP NOT NULL; 
          ALTER TABLE transactions ALTER COLUMN txn_id SET DEFAULT NULL;
        END IF; 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='personnel' AND column_name='name') THEN 
          ALTER TABLE personnel ALTER COLUMN name DROP NOT NULL; 
        END IF; 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='name') THEN 
          ALTER TABLE users ALTER COLUMN name DROP NOT NULL; 
        END IF; 
      END $$;`,

      // Create unique indexes to support ON CONFLICT clauses
      `CREATE UNIQUE INDEX IF NOT EXISTS users_uid_idx ON users(uid);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS students_student_id_idx ON students(student_id);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_code_idx ON subscriptions(code);`
    ];

    // Execute schema statements safely with a overall timeout
    const runQueryWithTimeout = async (stmt: string, ms = 3000) => {
      return Promise.race([
        pool.query(stmt),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), ms))
      ]);
    };

    for (const stmt of statements) {
      try {
        await runQueryWithTimeout(stmt, 3000);
      } catch (err: any) {
        // Silently skip if table ownership or existing structure prevents alter or on timeout
      }
    }
  } catch (error) {
    // Graceful catch for global pool connection
  }
};

const pool = createPool();
export const db = drizzle(pool, { schema });
