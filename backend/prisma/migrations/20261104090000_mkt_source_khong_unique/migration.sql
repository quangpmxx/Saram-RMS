-- Cho nhiều TKQC dùng chung 1 Nguồn MKT.
DROP INDEX "ad_accounts_mkt_source_id_key";
CREATE INDEX "ad_accounts_mkt_source_id_idx" ON "ad_accounts"("mkt_source_id");
