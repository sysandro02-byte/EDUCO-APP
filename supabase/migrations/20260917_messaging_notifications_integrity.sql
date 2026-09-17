-- EDUCO durable messaging + notification integrity.
CREATE TABLE IF NOT EXISTS public.messages (
  id bigserial PRIMARY KEY,
  school_id integer NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sender_id integer REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_id integer REFERENCES public.users(id) ON DELETE CASCADE,
  channel_id text NOT NULL DEFAULT 'general',
  message_type text NOT NULL DEFAULT 'direct',
  sender_name text NOT NULL,
  sender_role text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_type_check CHECK (message_type IN ('direct','channel')),
  CONSTRAINT messages_text_length_check CHECK (char_length(btrim(text)) BETWEEN 1 AND 4000),
  CONSTRAINT messages_channel_length_check CHECK (char_length(channel_id) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS messages_school_created_idx
  ON public.messages(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient_created_idx
  ON public.messages(recipient_id, created_at DESC) WHERE recipient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_sender_created_idx
  ON public.messages(sender_id, created_at DESC) WHERE sender_id IS NOT NULL;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id bigserial PRIMARY KEY,
  school_id integer NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE(endpoint),
  CONSTRAINT push_subscriptions_endpoint_length_check CHECK (char_length(endpoint) BETWEEN 12 AND 4096),
  CONSTRAINT push_subscriptions_key_length_check CHECK (char_length(p256dh) BETWEEN 10 AND 2048 AND char_length(auth) BETWEEN 4 AND 1024)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_school_idx
  ON public.push_subscriptions(school_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS school_id integer REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS sender_id integer REFERENCES public.users(id) ON DELETE SET NULL;

UPDATE public.notifications n
SET school_id = u.school_id
FROM public.users u
WHERE n.user_id = u.id
  AND n.school_id IS NULL
  AND u.school_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_school_created_idx
  ON public.notifications(school_id, created_at DESC)
  WHERE school_id IS NOT NULL;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
