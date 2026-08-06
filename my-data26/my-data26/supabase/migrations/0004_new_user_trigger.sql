-- Tự động tạo bản ghi profiles khi có user mới trong auth.users,
-- đồng thời xử lý mã giới thiệu (referral_code) truyền qua metadata lúc đăng ký.
create or replace function fn_handle_new_user() returns trigger as $$
declare
  v_referrer uuid;
  v_ref_code text;
begin
  v_ref_code := new.raw_user_meta_data->>'referral_code';

  if v_ref_code is not null and v_ref_code <> '' then
    select id into v_referrer from profiles where referral_code = v_ref_code;
  end if;

  insert into profiles (id, full_name, referred_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_referrer
  );

  return new;
end;
$$ language plpgsql security definer;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function fn_handle_new_user();
