-- HDFC FinCal enterprise analytics schema
-- This schema is intentionally anonymized and does not store PII.

CREATE DATABASE IF NOT EXISTS hdfc_fincal_analytics;
USE hdfc_fincal_analytics;

CREATE TABLE IF NOT EXISTS anonymous_calculator_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_uuid CHAR(36) NOT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  current_age TINYINT UNSIGNED NOT NULL,
  retirement_age TINYINT UNSIGNED NOT NULL,
  monthly_expenses INT UNSIGNED NOT NULL,
  healthcare_ratio DECIMAL(5,2) NOT NULL,
  medical_inflation_pct DECIMAL(5,2) NOT NULL,
  geo_modifier DECIMAL(5,2) NOT NULL,
  step_up_enabled BOOLEAN NOT NULL,
  annual_raise_pct DECIMAL(5,2) NOT NULL,
  sip_ceiling_pct DECIMAL(5,2) NOT NULL,
  post_retirement_return_pct DECIMAL(5,2) NOT NULL,
  retirement_duration_years TINYINT UNSIGNED NOT NULL,
  starting_sip INT UNSIGNED NOT NULL,
  scenario_baseline_corpus DECIMAL(18,2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_session_uuid (session_uuid),
  KEY idx_submitted_at (submitted_at),
  KEY idx_geo_modifier (geo_modifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
