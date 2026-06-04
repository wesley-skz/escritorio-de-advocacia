const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const app = express();

// Configurações Globais do Servidor
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // Necessário para processar JSON estruturado (carrinho de agendamentos)
app.use(express.static('.')); // Serve as páginas HTML e CSS automaticamente do diretório raiz

// Conexão com o Banco de Dados unificado do Escritório
const db = new sqlite3.Database('./advocacia.db');

// Inicialização das Tabelas (Estrutura Completa do Sistema)
db.serialize(() => {
    
    /* ==========================================================================
       TABELA DA ÁREA PÚBLICA (FÓRUM / OUVIDORIA)
       ========================================================================== */
    db.run(`CREATE TABLE IF NOT EXISTS sugestoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL,
        mensagem TEXT NOT NULL
    )`);

    /* ==========================================================================
       TABELA DE CONTROLE DE ACESSOS (SISTEMA DE RH / PRIVADO)
       ========================================================================== */
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        nome TEXT NOT NULL,
        cargo TEXT NOT NULL,
        status TEXT DEFAULT 'Ativo'
    )`, (err) => {
        if (!err) {
            // Verifica se a tabela está vazia para inserir o Administrador Padrão (RH)
            db.get("SELECT COUNT(*) as total FROM usuarios", [], (err, row) => {
                if (row && row.total === 0) {
                    const insertAdmin = "INSERT INTO usuarios (usuario, senha, nome, cargo, status) VALUES (?, ?, ?, ?, ?)";
                    db.run(insertAdmin, ['admin', '123', 'Diretor Geral', 'Administrador', 'Ativo']);
                    console.log("----------------------------------------------------------------");
                    console.log("➡️ Utilizador padrão criado: Usuário: admin | Senha: 123");
                    console.log("----------------------------------------------------------------");
                }
            });
        }
    });

    /* ==========================================================================
       TABELAS DA OPERAÇÃO INTERNA (CLIENTES, SERVIÇOS E AGENDAMENTOS)
       ========================================================================== */
    db.run(`CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        nome TEXT NOT NULL, 
        cpf TEXT NOT NULL, 
        telefone TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS servicos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        descricao TEXT NOT NULL, \n        preco REAL NOT NULL, \n        tempo_estimado INTEGER NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        data TEXT NOT NULL, 
        cliente_id INTEGER NOT NULL, 
        responsavel TEXT NOT NULL, 
        total REAL NOT NULL, \n        tempo_total INTEGER NOT NULL,
        FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS itens_agendamento (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        agendamento_id INTEGER NOT NULL, 
        servico_id INTEGER NOT NULL, 
        preco_cobrado REAL NOT NULL,
        FOREIGN KEY(agendamento_id) REFERENCES agendamentos(id), 
        FOREIGN KEY(servico_id) REFERENCES servicos(id)
    )`);
});

/* ==========================================================================
   ROTAS DA ÁREA PÚBLICA (FÓRUM DE CRÍTICAS E SUGESTÕES)
   ========================================================================== */

// Rota para salvar um novo feedback enviado pelo formulário público
app.post('/salvar-sugestao', (req, res) => {
    const { nome, tipo, mensagem } = req.body;
    
    if (!nome || !tipo || !mensagem) {
        return res.status(400).send("Erro: Todos os campos do formulário são obrigatórios.");
    }

    const sql = 'INSERT INTO sugestoes (nome, tipo, mensagem) VALUES (?, ?, ?)';
    db.run(sql, [nome, tipo, mensagem], function(err) {
        if (err) {
            return res.status(500).send("Erro interno ao salvar no mural: " + err.message);
        }
        // Redireciona o cliente de forma limpa de volta para a aba do fórum
        res.redirect('/sugestoes.html');
    });
});

// Rota API para listar as sugestões no mural público de forma dinâmica
app.get('/listar-sugestoes', (req, res) => {
    const sql = 'SELECT nome, tipo, mensagem FROM sugestoes ORDER BY id DESC';
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

/* ==========================================================================
   ROTA DE AUTENTICAÇÃO E LOGIN (CONTROLE DE ACESSO)
   ========================================================================== */

app.post('/autenticar', (req, res) => {
    const { usuario, senha } = req.body;

    const sql = "SELECT * FROM usuarios WHERE usuario = ? AND senha = ? AND status = 'Ativo'";
    db.get(sql, [usuario, senha], (err, row) => {
        if (err) {
            return res.status(500).send("Erro interno no servidor ao tentar autenticar.");
        }
        
        if (row) {
            // Autenticação bem-sucedida! Redireciona imediatamente para a HOME PRIVADA
            res.redirect('/painel.html');
        } else {
            // Credenciais inválidas: emite um alerta visual e mantém na tela de login
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
   ROTAS DA ÁREA PRIVADA (CLIENTES, SERVIÇOS E HISTÓRICOS DE AGENDAMENTO)
   ========================================================================== */

// Cadastrar novo cliente
app.post('/salvar-cliente', (req, res) => {
    const { nome, cpf, telefone } = req.body;
    const sql = 'INSERT INTO clientes (nome, cpf, telefone) VALUES (?, ?, ?)';
    db.run(sql, [nome, cpf, telefone], function(err) {
        if (err) return res.status(500).send("Erro ao salvar cliente: " + err.message);
        res.redirect('/clientes.html');
    });
});

// Listar clientes para tabelas e selects internos
app.get('/listar-clientes', (req, res) => {
    db.all('SELECT * FROM clientes ORDER BY nome ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Cadastrar novo tipo de serviço/honorário administrativo
app.post('/salvar-servico', (req, res) => {
    const { descricao, preco, tempo_estimado } = req.body;
    const sql = 'INSERT INTO servicos (descricao, preco, tempo_estimado) VALUES (?, ?, ?)';
    db.run(sql, [descricao, preco, tempo_estimado], function(err) {
        if (err) return res.status(500).send("Erro ao salvar serviço: " + err.message);
        res.redirect('/servicos.html');
    });
});

// Listar serviços cadastrados
app.get('/listar-servicos', (req, res) => {
    db.all('SELECT * FROM servicos ORDER BY descricao ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Finalizar e salvar ordens de serviço/agendamentos (Mestre-Detalhe estruturado)
app.post('/finalizar-agendamento', (req, res) => {
    const { cliente_id, data, responsavel, total, tempo_total, servicos } = req.body;

    const sqlMestre = `INSERT INTO agendamentos (data, cliente_id, responsavel, total, tempo_total) VALUES (?, ?, ?, ?, ?)`;
    
    db.run(sqlMestre, [data, cliente_id, responsavel, total, tempo_total], function(errMestre) {
        if (errMestre) return res.status(500).json({ success: false, error: errMestre.message });

        const agendamentoId = this.lastID;
        const sqlDetalhe = `INSERT INTO itens_agendamento (agendamento_id, servico_id, preco_cobrado) VALUES (?, ?, ?)`;

        let erros = 0;
        let processados = 0;

        if (!servicos || servicos.length === 0) {
            return res.json({ success: true });
        }

        servicos.forEach(s => {
            db.run(sqlDetalhe, [agendamentoId, s.id, s.preco], function(errDetalhe) {
                processados++;
                if (errDetalhe) erros++;

                if (processados === servicos.length) {
                    if (erros > 0) return res.status(500).json({ success: false, error: "Erro ao salvar itens vinculados." });
                    res.json({ success: true });
                }
            });
        });
    });
});

// Listar todo o histórico de agendamentos salvos (Mestre) com INNER JOIN para o nome do cliente
app.get('/listar-agendamentos', (req, res) => {
    const sql = `
        SELECT a.id, a.data, a.responsavel, a.total, a.tempo_total, c.nome as nome_cliente 
        FROM agendamentos a 
        INNER JOIN clientes c ON a.cliente_id = c.id 
        ORDER BY a.id DESC`;
        
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Listar serviços específicos atrelados a uma O.S. selecionada (Detalhe)
app.get('/detalhes-agendamento/:id', (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT i.preco_cobrado, s.descricao, s.tempo_estimado 
        FROM itens_agendamento i 
        INNER JOIN servicos s ON i.servico_id = s.id 
        WHERE i.agendamento_id = ?`;
        
    db.all(sql, [id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Inicialização do Servidor na porta local 3000
app.listen(3000, () => {
    console.log("================================================================");
    console.log("🚀 Servidor da Advocacia Integrada rodando em http://localhost:3000");
    console.log("================================================================");
});
