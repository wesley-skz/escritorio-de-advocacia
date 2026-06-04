const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const app = express();

// Configurações do Servidor
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); 
app.use(express.static('.')); // Serve as páginas HTML e CSS automaticamente

// Banco de Dados do Escritório
const db = new sqlite3.Database('./advocacia.db');

// Inicialização da Tabela do Fórum Público
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS sugestoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL,
        mensagem TEXT NOT NULL
    )`);

    // Mantendo tabelas da futura área privada intactas
    db.run(`CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, cpf TEXT NOT NULL, telefone TEXT NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS servicos (id INTEGER PRIMARY KEY AUTOINCREMENT, descricao TEXT NOT NULL, preco REAL NOT NULL, tempo_estimado INTEGER NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS agendamentos (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, cliente_id INTEGER NOT NULL, responsavel TEXT NOT NULL, total REAL NOT NULL, tempo_total INTEGER NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS itens_agendamento (id INTEGER PRIMARY KEY AUTOINCREMENT, agendamento_id INTEGER NOT NULL, servico_id INTEGER NOT NULL, preco_cobrado REAL NOT NULL)`);
});

/* ==========================================================================
   ROTAS CORRIGIDAS DA ÁREA PÚBLICA (FÓRUM)
   ========================================================================== */

// Rota de Salvamento Corrigida (Evita erros de cabeçalho ou travamentos)
app.post('/salvar-sugestao', (req, res) => {
    const { nome, tipo, mensagem } = req.body;
    
    if(!nome || !tipo || !mensagem) {
        return res.status(400).send("Todos os campos do formulário são obrigatórios.");
    }

    const sql = 'INSERT INTO sugestoes (nome, tipo, mensagem) VALUES (?, ?, ?)';
    db.run(sql, [nome, tipo, mensagem], function(err) {
        if (err) {
            return res.status(500).send("Erro interno ao salvar no banco de dados: " + err.message);
        }
        // Redireciona de volta para a aba do fórum de forma limpa
        res.redirect('/sugestoes.html');
    });
});

// Rota para Listagem de Feedbacks no Mural
app.get('/listar-sugestoes', (req, res) => {
    const sql = 'SELECT nome, tipo, mensagem FROM sugestoes ORDER BY id DESC';
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Inicialização do Servidor
app.listen(3000, () => {
    console.log("Servidor Jurídico ativo em http://localhost:3000");
});
