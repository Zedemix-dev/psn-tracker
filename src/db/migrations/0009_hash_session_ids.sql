UPDATE "sessions" SET "id" = encode(sha256(convert_to("id", 'UTF8')), 'hex');
