-- Update handle_new_user to grant super_admin for bootstrap users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record admin_invites%ROWTYPE;
  new_role app_role;
BEGIN
  SELECT * INTO invite_record 
  FROM public.admin_invites 
  WHERE email = NEW.email 
    AND accepted_at IS NULL 
    AND expires_at > now();
  
  IF invite_record.id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
    
    -- Grant super_admin for bootstrap users, admin for others
    IF NEW.email IN ('dev.codestrokes@gmail.com', 'gianfranco@kvatt.com') THEN
      new_role := 'super_admin';
    ELSE
      new_role := 'admin';
    END IF;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, new_role);
    
    UPDATE public.admin_invites 
    SET accepted_at = now() 
    WHERE id = invite_record.id;
  END IF;
  
  RETURN NEW;
END;
$$;