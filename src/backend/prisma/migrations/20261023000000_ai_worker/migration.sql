-- Additive worker state. Existing reservations remain pending until processed.
ALTER TABLE ai_provider_calls ADD COLUMN analyze_input JSONB;
ALTER TABLE ai_provider_calls ADD CONSTRAINT ai_provider_calls_input_check
  CHECK (analyze_input IS NULL OR jsonb_typeof(analyze_input) = 'object');
ALTER TABLE ai_reservations ADD COLUMN unit_used INTEGER;
ALTER TABLE ai_reservations ADD CONSTRAINT ai_reservations_unit_used_check
  CHECK (unit_used IS NULL OR (unit_used >= 0 AND unit_used <= units));
