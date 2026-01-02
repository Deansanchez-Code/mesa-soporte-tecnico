-- Seed environments table with initial data
INSERT INTO environments (name, type, capacity) VALUES 
('Auditorio Principal', 'AUDITORIO', 100),
('Sala de Informática 1', 'SALA_INFORMATICA', 30),
('Sala de Informática 2', 'SALA_INFORMATICA', 30),
('Laboratorio de Redes', 'LABORATORIO', 25),
('Ambiente 201', 'AULA', 40),
('Ambiente 202', 'AULA', 40)
ON CONFLICT DO NOTHING;
