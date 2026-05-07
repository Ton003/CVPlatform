UPDATE job_offers jo SET job_role_id = jrl."jobRoleId" FROM job_role_levels jrl WHERE jo.job_role_level_id = jrl.id AND jo.job_role_id IS NULL;
