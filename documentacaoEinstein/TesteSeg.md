

o objetivo foi analisar como   o HTTP responde a comando dentro do CMD 
Testamos acessar /admin.html direto pela URL e ver como o servidor responde no CMD. 
O arquivo HTML até é entregue, mas sem sessão válida o painel não libera os dados, 
e rotas da API como /api/telemetria/talhao/1 bloqueiam com 401 Unauthorized. Isso mostra 
que esconder ou redirecionar tela no frontend não basta: o controle de acesso por perfil e 
a proteção nas rotas/bordas HTTP precisam estar garantidos no backend.
trandorporte e bordas htpp 



como fazer .: 1- CMD + navegador 
		curl -i https://frutlog.com.br/
o site devolver =  http/1.1  200 ok 
mas aparece = X-power-by : express "  nao mostra cabeçalho extra de segurança .


2- tentando acesso direto a uma pagina interna (/admin.html ) 
no CMD .: 
	
	curl -i https://frutlog.com.br/admin.html

o servidor devolver http/1.1  200 ok  e entrega  todo o cod  do html ( ESTATICO) 
	o controle de tela e feito no js/auht.js 

3- provando q a api bloqueia quyem nao e autenticado .
no CMD .: 
 	curl -i https://frutlog.com.br/api/telemetria/talhao/1

resultado sem sessao/token a api  do frutlog bloqueia  com  HTTP/1.1 401 ( UNAUTORIZED ). 




 1- testando como o servidor lida  con o protocolo http sem https pra ver se seguem  o msm bloquei  401.

	no cmd.:

			curl -i http://frutlog.com.br/

	o resultado foi  HTTP/1.1 301 move permanently ( movido pernamentemente)
isso resulta q o o servidor  estar forçando  o redirecionamento pro https 
( https= conversa usando um certificado de forma embaralhadas ) 

2- opcional tentando outra rota sem login 
  no cmd.:
		 curl -i https://frutlog.com.br/api/talhoes

protegido com a msm  401 . 













dominio http com certificado  valido ,
mas a resposta inicial das paginas expoes " x-powered-by:expresse" 
nao envia cabeçalho d eproiteção na html como hsts e csp a api tras 
x-powered-by: Express
content-type: application/json; charset=utf-8
x-content-type-options: nosniff
cache-control: no-store


apresentação x autorização  
frutlog.com.br/api/telemtria/talhao 1
retonas 401  unautorized  com o a mssagem " Sessao expirada ou revogada. Faca login novamente." 