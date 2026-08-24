CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  source_url TEXT,
  original_lang TEXT NOT NULL DEFAULT 'ru',
  translation_lang TEXT NOT NULL DEFAULT 'en',
  duration_sec NUMERIC,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO anon, authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prototype open access to videos" ON public.videos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  speaker TEXT NOT NULL DEFAULT 'Speaker 1',
  text TEXT NOT NULL,
  translation TEXT,
  start_sec NUMERIC NOT NULL,
  end_sec NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.segments TO anon, authenticated;
GRANT ALL ON public.segments TO service_role;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prototype open access to segments" ON public.segments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX segments_video_idx ON public.segments(video_id, idx);

CREATE TABLE public.vocabulary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  video_title TEXT,
  word TEXT NOT NULL,
  translation TEXT,
  sentence TEXT,
  timestamp_sec NUMERIC,
  kind TEXT NOT NULL DEFAULT 'word',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vocabulary TO anon, authenticated;
GRANT ALL ON public.vocabulary TO service_role;
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prototype open access to vocabulary" ON public.vocabulary FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.videos (id, title, source_url, original_lang, translation_lang, duration_sec, is_demo)
VALUES ('11111111-1111-1111-1111-111111111111', 'Demo — Russian dialogue', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'ru', 'en', 60, true);

INSERT INTO public.segments (video_id, idx, speaker, text, translation, start_sec, end_sec) VALUES
('11111111-1111-1111-1111-111111111111', 0, 'Анна', 'Я не понимаю, что ты хочешь сказать.', 'I don''t understand what you mean.', 2, 6),
('11111111-1111-1111-1111-111111111111', 1, 'Иван', 'Я просто пытаюсь тебе помочь.', 'I''m just trying to help you.', 6.5, 10),
('11111111-1111-1111-1111-111111111111', 2, 'Анна', 'Помочь? Ты всегда так говоришь.', 'Help? You always say that.', 11, 15),
('11111111-1111-1111-1111-111111111111', 3, 'Иван', 'Потому что мне не всё равно.', 'Because I care.', 16, 20),
('11111111-1111-1111-1111-111111111111', 4, 'Анна', 'Тогда объясни спокойно, без криков.', 'Then explain calmly, without shouting.', 21, 26),
('11111111-1111-1111-1111-111111111111', 5, 'Иван', 'Хорошо. Давай начнём сначала.', 'Alright. Let''s start over.', 27, 31),
('11111111-1111-1111-1111-111111111111', 6, 'Анна', 'Я слушаю тебя очень внимательно.', 'I''m listening to you very carefully.', 32, 36),
('11111111-1111-1111-1111-111111111111', 7, 'Иван', 'Мне кажется, мы говорим о разных вещах.', 'It seems to me we are talking about different things.', 37, 43);