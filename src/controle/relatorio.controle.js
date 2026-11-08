// controle para separar  a rota do servidor e o front, para que o front chame a rota /api/relatorios e o express vai redirecionar para o arquivo relatorio.routes.js que esta na pasta routes, e la dentro do arquivo relatorio.routes.js tem a rota de teste que retorna uma mensagem de sucesso, isso e so um exemplo de como modularizar as rotas, depois podemos adicionar as rotas de relatorios de acordo com a necessidade do sistema. isso vai dimunuir a arquivos monolitico  comentada pelo professor icaro . 


 // Lógica para listar relatórios
module.exports = {
  listar(req, res) {
    try {
      // Aqui colocas a lógica ou a consulta ao banco de dados dos relatórios
      return res.json({ 
        sucesso: true, 
        mensagem: 'Dados de relatórios carregados com sucesso através do Controller!' 
      });
    } catch (error) {
      return res.status(500).json({ erro: 'Erro interno ao buscar relatórios' });
    }
  }
};