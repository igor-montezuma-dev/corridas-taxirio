CREATE TABLE corridas (
  id            CHAR(36)     NOT NULL,
  passageiro_id VARCHAR(64)  NOT NULL,
  motorista_id  VARCHAR(64)  NULL,
  status        ENUM('solicitada', 'aceita', 'em_andamento', 'finalizada') NOT NULL DEFAULT 'solicitada',
  origem        VARCHAR(255) NOT NULL,
  destino       VARCHAR(255) NOT NULL,
  criado_em     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  INDEX idx_corridas_passageiro (passageiro_id),
  INDEX idx_corridas_motorista (motorista_id),
  INDEX idx_corridas_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE idempotency_keys (
  passageiro_id VARCHAR(64)  NOT NULL,
  chave         VARCHAR(100) NOT NULL,
  corrida_id    CHAR(36)     NOT NULL,
  criado_em     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (passageiro_id, chave),
  CONSTRAINT fk_idempotency_keys_corrida
    FOREIGN KEY (corrida_id) REFERENCES corridas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;