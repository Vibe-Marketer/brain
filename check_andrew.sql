
SELECT user_id, host_email, webhook_secret IS NOT NULL as has_personal_secret 
FROM user_settings 
WHERE host_email = 'andrew@aisimple.co';
