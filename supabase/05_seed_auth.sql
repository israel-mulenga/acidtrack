-- =====================================================================
-- AcidTrack — Comptes Supabase Auth pour les profils de démonstration
-- À exécuter APRÈS 04_auth_rls.sql (nécessite la colonne utilisateurs.auth_id
-- et l'extension pgcrypto).
--
-- Mot de passe unique de démonstration : AcidTrack2024!
-- L'identifiant auth.users est volontairement identique à celui de la
-- ligne `utilisateurs` correspondante : le rattachement auth_id devient
-- une simple copie, ce qui rend le script lisible et rejouable.
--
-- Rappel important : pour que ces comptes puissent se connecter
-- immédiatement (sans lien de confirmation par e-mail), désactivez
-- « Confirm email » dans Supabase Dashboard > Authentication > Providers > Email.
-- =====================================================================

create extension if not exists pgcrypto;

do $$
declare
  v_mdp text := 'AcidTrack2024!';
  r record;
begin
  for r in
    select id, email, nom
    from utilisateurs
    where id in (
      '66666666-6666-6666-6666-666666666601',
      '66666666-6666-6666-6666-666666666602',
      '66666666-6666-6666-6666-666666666603',
      '66666666-6666-6666-6666-666666666604',
      '66666666-6666-6666-6666-666666666605'
    )
    and email is not null
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token,
      recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated',
      r.email, crypt(v_mdp, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nom', r.nom), false, '', '', '', ''
    )
    on conflict (id) do update set
      email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = excluded.email_confirmed_at,
      updated_at = now();

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), r.id, r.id::text,
      jsonb_build_object('sub', r.id::text, 'email', r.email),
      'email', now(), now(), now()
    )
    on conflict (provider, provider_id) do nothing;
  end loop;

  update utilisateurs set auth_id = id, statut = 'ACTIF'
  where id in (
    '66666666-6666-6666-6666-666666666601',
    '66666666-6666-6666-6666-666666666602',
    '66666666-6666-6666-6666-666666666603',
    '66666666-6666-6666-6666-666666666604',
    '66666666-6666-6666-6666-666666666605'
  );
end $$;
