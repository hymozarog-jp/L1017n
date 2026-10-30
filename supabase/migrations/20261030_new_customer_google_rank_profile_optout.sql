-- For brand-new accounts only. Existing members retain all privacy settings.
-- New shoppers join the leaderboard at 0 LYD with their own Google name/photo
-- when they sign up using Google. The signup screen prominently discloses the
-- default public visibility and Account > Ranking privacy provides opt-outs.
-- Public ranking already restricts personal identity display to the explicit
-- share_google_profile setting and checks Google-owned avatar hosts.
CREATE OR REPLACE FUNCTION public.initialize_new_leaderboard_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.leaderboard_profiles
    (user_id,nickname,public_visible,share_google_profile)
  VALUES
    (NEW.id,
     'متسوق' || left(replace(NEW.id::text,'-',''),12),
     true,
     true)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_leaderboard ON auth.users;
CREATE TRIGGER on_auth_user_created_leaderboard
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.initialize_new_leaderboard_profile();
