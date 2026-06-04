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

// Inicialização das Tabelas
db.serialize(() => {
    // Tabela do Fórum Público
    db.run(`CREATE TABLE IF NOT EXISTS sugestoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL,
        mensagem TEXT NOT NULL
    )`);

    // MUDANÇA: Criando a tabela de Usuários para o controle de login e RH
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        nome TEXT NOT NULL,
        cargo TEXT NOT NULL,
        status TEXT DEFAULT 'Ativo'
    )`, (err) => {
        if (!err) {
            // Insere um utilizador padrão (Admin) para o primeiro acesso de teste
            db.get("SELECT COUNT(*) as total FROM usuarios", [], (err, row) => {
                if (row && row.total === 0) {
                    const insertAdmin = "INSERT INTO usuarios (usuario, senha, nome, cargo, status) VALUES (?, ?, ?, ?, ?)";
                    db.run(insertAdmin, ['admin', '123', 'Diretor Geral', 'Administrador', 'Ativo']);
                    console.log("➡️ Utilizador padrão criado com sucesso: Usuário: admin | Senha: 123");
                }
            });
        }
    });

    // Mantendo tabelas da futura área privada intactas para posterior migração
    db.run(`CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, cpf TEXT NOT NULL, telefone TEXT NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS servicos (id INTEGER PRIMARY KEY AUTOINCREMENT, descricao TEXT NOT NULL, preco REAL NOT NULL, tempo_estimado INTEGER NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS agendamentos (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, cliente_id INTEGER NOT NULL, responsavel TEXT NOT NULL, total REAL NOT NULL, tempo_total INTEGER NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS itens_agendamento (id INTEGER PRIMARY KEY AUTOINCREMENT, agendamento_id INTEGER NOT NULL, servico_id INTEGER NOT NULL, preco_cobrado REAL NOT NULL)`);
});

/* ==========================================================================
   ROTAS DA ÁREA PÚBLICA (FÓRUM)
   ========================================================================== */

// Rota de Salvamento de Feedbacks
app.post('/salvar-sugestao', (req, res) => {
    const { nome, tipo, message } = req.body; // Caso o textarea use 'mensagem' ou 'message'
    const mensagem = req.body.mensagem || message;

    if(!nome || !tipo || !mensagem) {
        return res.status(400).send("Todos os campos do formulário são obrigatórios.");
    }

    const sql = 'INSERT INTO sugestoes (nome, tipo, mensagem) VALUES (?, ?, ?)';
    db.run(sql, [nome, tipo, mensagem], function(err) {
        if (err) return res.status(500).send("Erro ao salvar no banco: " + err.message);
        res.redirect('/sugestoes.html');
    });
});

// Rota para Listagem de Feedbacks no Mural
app.get('/listar-sugestoes', (req, res) => {
    const sql = 'SELECT nome, tipo, mensagem FROM sugestoes ORDER BY id DESC';
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

/* ==========================================================================
   MUDANÇA: ROTA DE AUTENTICAÇÃO (VALIDAÇÃO DE LOGIN VIA BANCO)
   ========================================================================== */
app.post('/autenticar', (req, res) => {
    const { usuario, senha } = req.body;

    const sql = "SELECT * FROM usuarios WHERE usuario = ? AND senha = ? AND status = 'Ativo'";
    db.get(sql, [usuario, senha], (err, row) => {
        if (err) {
            return res.status(500).send("Erro interno no servidor ao autenticar.");
        }
        
        if (row) {
            // Login efetuado com sucesso! 
            // Como estamos criando o esqueleto, vamos redirecioná-lo temporariamente para a listagem de agendamentos (área privada)
            res.redirect('/consulta_agendamentos.html');
        } else {
            // Caso os dados estejam incorretos
            res.send(`
                <script>
                    alert('Usuário ou Senha incorretos, ou conta inativa!');
                    window.location.href = '/login.html';
                </script>
            `);
        }
    });
});

/* ==========================================================================
   ROTAS PRIVADAS (Herdadas que serão organizadas no painel privado)
   ========================================================================== */
app.post('/salvar-cliente', (req, res) => {
    const { nome, cpf, telefone } = req.body;
    db.run('INSERT INTO clientes (nome, cpf, telefone) VALUES (?, ?, ?)', [nome, cpf, telefone], () => res.redirect('/clientes.html'));
});

app.get('/listar-clientes', (req, res) => {
    db.all('SELECT * FROM clientes ORDER BY nome ASC', [], (err, rows) => res.json(rows));
});

app.post('/salvar-servico', (req, res) => {
    const { descricao, preco, tempo_estimado } = req.body;
    db.run('INSERT INTO servicos (descricao, preco, tempo_estimado) VALUES (?, ?, ?)', [descricao, preco, tempo_estimado], () => res.redirect('/servicos.html'));
});

app.get('/listar-servicos', (req, res) => {
    db.all('SELECT * FROM servicos ORDER BY descricao ASC', [], (err, rows) => res.json(rows));
});

app.get('/listar-agendamentos', (req, res) => {
    const sql = `SELECT a.id, a.data, a.responsavel, a.total, a.tempo_total, c.nome as nome_cliente 
                 FROM agendamentos a INNER JOIN clientes c ON a.cliente_id = c.id ORDER BY a.id DESC`;
    db.all(sql, [], (err, rows) => res.json(rows));
});

// Inicialização do Servidor
app.listen(3000, () => {
    console.log("Servidor Jurídico ativo em http://localhost:3000");
});
