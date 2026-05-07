DO $$
DECLARE
    r RECORD;
    l_id UUID;
    r_id UUID;
    new_emp_id UUID;
BEGIN
    SELECT id INTO l_id FROM job_role_levels LIMIT 1;
    SELECT id INTO r_id FROM job_roles LIMIT 1;
    
    FOR r IN SELECT id, first_name, last_name, email FROM users WHERE role IN ('manager', 'admin') AND employee_id IS NULL LOOP
        INSERT INTO employees (employee_id, first_name, last_name, email, hire_date, status, is_manager, job_role_id, job_role_level_id, user_id)
        VALUES ('EMP-' || floor(random()*9000 + 1000)::text, r.first_name, r.last_name, r.email, CURRENT_DATE, 'active', true, r_id, l_id, r.id)
        RETURNING id INTO new_emp_id;
        
        UPDATE users SET employee_id = new_emp_id WHERE id = r.id;
    END LOOP;
END $$;
