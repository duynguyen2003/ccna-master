-- Existing labs retain their original access rules until explicitly configured.
ALTER TABLE "labs" ADD COLUMN "access_policy" JSONB;
ALTER TABLE "labs" ADD CONSTRAINT "labs_access_policy_shape" CHECK (
  access_policy IS NULL OR (
    jsonb_typeof(access_policy) = 'object'
    AND access_policy ?& ARRAY['mode', 'lessonIds', 'requiredForCompletion']
    AND access_policy->>'mode' IN ('OPEN', 'LESSONS', 'CAPSTONE')
    AND jsonb_typeof(access_policy->'lessonIds') = 'array'
    AND jsonb_typeof(access_policy->'requiredForCompletion') = 'boolean'
  )
);
