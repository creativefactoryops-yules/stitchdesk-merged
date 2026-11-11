-- Local RLS check against plain Postgres with stub auth/storage schemas (see README "Testing").
-- Each block raises an exception if a rule is broken.
\set ON_ERROR_STOP 1
insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'a@shop-a.test'), ('22222222-2222-2222-2222-222222222222', 'b@shop-b.test');

-- Owner A creates shop A
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select set_config('request.jwt.claims', '{"email":"a@shop-a.test"}', false);
select public.create_shop('Shop A', 'shop-a');
-- Owner B creates shop B
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select set_config('request.jwt.claims', '{"email":"b@shop-b.test"}', false);
select public.create_shop('Shop B', 'shop-b');
insert into public.shop_faq (shop_id, question, answer) values (public.my_shop(), 'Do you deliver?', 'Yes');
reset role;
create temp table t_ids as select slug, id from public.shops;
grant select on t_ids to anon, authenticated;

-- A client books at shop A, anonymously, through the public function
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claims', '', false);
create temp table t_booking as
  select public.public_create_booking('shop-a', 'Rosa', 'rosa@example.com', '', array[current_date + 3], 'email', 'Sagging springs',
    '{"piece":"sofa","width":80,"depth":36,"units":"in","fabric":"velvet"}'::jsonb, 1200, 1900, '[]'::jsonb, '[]'::jsonb) as r;
do $$ begin
  if (select count(*) from public.jobs) <> 0 then raise exception 'anon can read jobs table'; end if;
  if (select count(*) from public.clients) <> 0 then raise exception 'anon can read clients table'; end if;
  if (select count(*) from public.shops) <> 0 then raise exception 'anon can read shops table'; end if;
  if public.public_get_job((select r->>'token' from t_booking)) is null then raise exception 'token lookup failed'; end if;
  if public.public_get_job('0000000000000000000000000000000000000000000000') is not null then raise exception 'bad token returned a job'; end if;
  if (public.public_shop('shop-b')->'faq'->0->>'answer') <> 'Yes' then raise exception 'public shop faq missing'; end if;
  if public.public_shop('nope') is not null then raise exception 'unknown shop returned data'; end if;
end $$;
select public.public_add_message((select r->>'token' from t_booking), 'Can I come Saturday?');
do $$ begin
  begin
    insert into public.jobs (shop_id, title) values ((select id from t_ids where slug = 'shop-a'), 'x');
    raise exception 'anon inserted a job directly';
  exception when insufficient_privilege then null; -- expected: RLS blocks it
  end;
  begin
    perform public.create_shop('Evil', 'evil');
    raise exception 'anon created a shop';
  exception when insufficient_privilege then null; -- expected: no EXECUTE for anon
  end;
end $$;
-- Photo uploads: allowed into a real shop's folder, refused anywhere else.
insert into storage.objects (bucket_id, name) values ('photos', (select id from t_ids where slug = 'shop-a')::text || '/job/a.jpg');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('photos', 'not-a-shop/x.jpg');
    raise exception 'anon uploaded outside a shop folder';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Owner B must NOT see shop A's job; owner A must.
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select set_config('request.jwt.claims', '{"email":"b@shop-b.test"}', false);
do $$ begin
  if (select count(*) from public.jobs) <> 0 then raise exception 'shop B sees shop A jobs'; end if;
  if (select count(*) from public.clients) <> 0 then raise exception 'shop B sees shop A clients'; end if;
  if (select count(*) from public.shops) <> 1 then raise exception 'shop B sees other shops'; end if;
  update public.jobs set stage = 'ready'; -- silently affects 0 rows under RLS
end $$;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select set_config('request.jwt.claims', '{"email":"a@shop-a.test"}', false);
do $$ begin
  if (select count(*) from public.jobs) <> 1 then raise exception 'shop A cannot see its job'; end if;
  if (select stage from public.jobs) <> 'lead' then raise exception 'shop B changed shop A job'; end if;
  if (select count(*) from public.messages where sender = 'client') <> 1 then raise exception 'client message missing'; end if;
  if (select count(*) from public.bookings) <> 1 then raise exception 'booking missing'; end if;
  begin
    insert into public.clients (shop_id, name) values ((select id from t_ids where slug = 'shop-b'), 'x');
    raise exception 'shop A wrote into shop B';
  exception when insufficient_privilege then null;
  end;
end $$;
do $$ begin
  update public.shops set hours = 'Mon-Fri' where slug = 'shop-a';
  if (select hours from public.shops where slug = 'shop-a') <> 'Mon-Fri' then raise exception 'owner cannot edit shop'; end if;
  begin
    update public.shops set plan = 'active' where slug = 'shop-a';
    raise exception 'owner changed own billing plan';
  exception when insufficient_privilege then null;
  end;
end $$;
-- Staff invite: A invites a colleague by email; the colleague is linked on first sign-in.
insert into public.staff (shop_id, email, role) values (public.my_shop(), 'helper@shop-a.test', 'staff');
reset role;
insert into auth.users values ('33333333-3333-3333-3333-333333333333', 'helper@shop-a.test');
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select set_config('request.jwt.claims', '{"email":"helper@shop-a.test"}', false);
do $$ begin
  if public.my_shop() is null then raise exception 'invited staff not linked'; end if;
  if (select count(*) from public.jobs) <> 1 then raise exception 'invited staff cannot see jobs'; end if;
end $$;
reset role;
select 'RLS TESTS PASSED' as result;
