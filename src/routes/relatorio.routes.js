//por uma  observação do professor icaro o sistema ainda tava mt bagunçado int  foi resolvido ajustar organizar e refatorar aqui estamos no processo de ajuste 


// procurei um  meio para isso e e achei o meotodo de controle de rotas  isso  vai separar os endereços  da rota

//deixanod o sistema mais  organizado e modularizado,  e  tambem vai diminuir o tamanho do arquivo server.js que estava muito grande e monolitico,  e tambem vai facilitar a manutenção do sistema, facilitar a leitura de cod, facilitara a  organização etc .    

const { Router } = require('express');
const relatorioController = require('../controle/relatorio.controle');
const router = Router();

// Quando chamarem a rota GET '/', executa a função 'listar' do controller
router.get('/', relatorioController.listar);

module.exports = router;
