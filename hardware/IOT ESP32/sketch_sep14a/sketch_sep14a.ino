#include <DHT.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <stdio.h>
#include <math.h>
#include <arduino_secrets.h>

// CONFIGURACAO DOS SENSORES
#define DHTPIN 4
#define DHTTYPE DHT11
#define SOLO_SENSOR 0
#define BUZZER_PIN 2
#define LED_PIN 3

#define LIMITE_TEMPERATURA 28.0
#define LIMITE_UMIDADE 24.0

// CONFIGS DA CONEXAO WIFI
const char* ssid = SECRET_SSID;
const char* password = SECRET_PASS;

// CONFIGS DO MQTT
const char* mqttServer = "mqtt3.thingspeak.com";
const int mqttPort = 1883;
const char* mqttClientID = SECRET_MQTT_CLIENT_ID;
const char* mqttUser = SECRET_MQTT_USERNAME;
const char* mqttPass = SECRET_MQTT_PASSWORD;
unsigned long channelID = SECRET_CHANNEL_ID;

// OBJETOS CRIADOS
DHT dht(DHTPIN, DHTTYPE);
WiFiClient espClient; // faz com que a ESP32 seja client WiFi e nao um "roteador"
PubSubClient client(espClient); // cria o cliente MQTT usando a conexao WiFi da ESP32

// VARIAVEIS INICIAIS DOS SENSORES
float temperaturaMinima = 999;// comeca com um valor alto para que a primeira temperatura lida seja menor e substitua esse valor
float temperaturaMaxima = -999;// comeca com um valor baixo para que a primeira temperatura lida seja maior e substitua esse valor

// VARIAVEIS DOS ALERTAS
bool ALERTA_TEMPERATURA = false;// guarda se o alerta de temperatura esta ativado ou nao
bool ALERTA_UMIDADE = false;// guarda se o alerta de umidade do ar esta ativado ou nao

// VARIAVEIS PARA PUBLICACAO CONDICIONAL
float ultimaTemperaturaPublicada = 999; // guarda a ultima temperatura realmente publicada
float ultimaUmidadePublicada = 999; // guarda a ultima umidade do ar realmente publicada
int ultimaUmidadeSoloPublicada = 999; // guarda a ultima umidade do solo realmente publicada

bool primeiraPublicacao = true;
// indica que ainda nao houve nenhuma publicacao
// a primeira leitura sera publicada obrigatoriamente

// LIMITES DE VARIACAO PARA PUBLICACAO
#define VARIACAO_TEMPERATURA 1.0 // publica quando a temperatura variar pelo menos 1 grau
#define VARIACAO_UMIDADE_AR 3.0 // publica quando a umidade do ar variar pelo menos 3%
#define VARIACAO_UMIDADE_SOLO 5 // publica quando a umidade do solo variar pelo menos 5%

// CALIBRACAO DO SENSOR DE UMIDADE DO SOLO
#define SOLO_SECO 4095// VALOR ANALOGICO DO SENSOR NO SOLO SECO
#define SOLO_MOLHADO 1500// VALOR ANALOGICO DO SENSOR NO SOLO MOLHADO
// ATENCAO:
// Esses valores sao exemplos.
// Ajuste de acordo com as leituras reais do seu sensor.

// INTERVALO ENTRE PUBLICACOES
#define INTERVALO_PUBLICACAO 16000 // o ThingSpeak exige aproximadamente 15 segundos entre mensagens, coloquei 16
unsigned long ultimaPublicacao = 0; // guarda o instante da ultima publicacao bem-sucedida

// FUNCAO PRA CONECTAR O WIFI
void conectarWiFi() {
  WiFi.mode(WIFI_STA); // coloca a ESP32 no modo Station, a ESP32 se conecta a um roteador existente e nao cria uma rede WiFi propria
  WiFi.disconnect(); // desconecta para evitar cache residual de conexoes antigas
  delay(100);

  WiFi.begin(ssid, password);
  // inicia a conexao usando o nome e a senha do WiFi

  while (WiFi.status() != WL_CONNECTED) { // enquanto nao estiver conectado continua tentando
    delay(500);
    Serial.print("Status: ");
    Serial.println(WiFi.status());
    // mostra no Monitor Serial o status da conexao
  }
  Serial.println("\nWiFi conectado!");
}

// FUNCAO PRA CONECTAR AO MQTT
void conectarMQTT() {
  while (!client.connected()) { // enquanto nao estiver conectado continua tentando

    Serial.println("Conectando ao MQTT do ThingSpeak...");

    if (client.connect(mqttClientID, mqttUser, mqttPass)) { // tenta conectar ao servidor MQTT usando as credenciais
      Serial.println("Conectado ao MQTT!");
    } else {
      Serial.println("Falha na conexao MQTT, tentando de novo em 5s...");
      delay(5000); // espera 5 segundos antes de tentar novamente
    }
  }
}

// FUNCAO PARA ATUALIZAR A TEMPERATURA MINIMA E MAXIMA
void atualizarTemperaturas(float temperatura) {
  if (temperatura < temperaturaMinima) {
    temperaturaMinima = temperatura; // se a temperatura atual for menor que a minima registrada substitui o valor da temperatura minima
  }

  if (temperatura > temperaturaMaxima) {
    temperaturaMaxima = temperatura; // se a temperatura atual for maior que a maxima registrada substitui o valor da temperatura maxima
  }

  Serial.print("Minima: ");
  Serial.print(temperaturaMinima);

  Serial.print(" | Maxima: ");
  Serial.println(temperaturaMaxima);

  Serial.println("------");
}

// FUNCAO PARA VERIFICAR OS ALERTAS
void verificarAlertas(float temperatura, float umidade) {

  // FUNCAO PARA O ALERTA DE TEMPERATURA
  if (temperatura > LIMITE_TEMPERATURA) {
    ALERTA_TEMPERATURA = true;
    Serial.println("ALERTA: TEMPERATURA ACIMA DO PERMITIDO!!");
    Serial.println(temperatura);
    Serial.println("------");
  } else {
    ALERTA_TEMPERATURA = false;// desativa o alerta quando a temperatura estiver dentro do limite permitido
  }

  // FUNCAO PARA O ALERTA DE UMIDADE
  if (umidade < LIMITE_UMIDADE) {
    ALERTA_UMIDADE = true;
    Serial.println("ALERTA: UMIDADE ABAIXO DO PERMITIDO!!");
    Serial.println(umidade);
    Serial.println("------");
  } else {
    ALERTA_UMIDADE = false; // desativa o alerta quando a umidade estiver dentro do limite permitido
  }

  // FUNCAO PARA O LED LIGAR QUANDO ALERTA ESTIVER ATIVADO
  if (ALERTA_UMIDADE == true || ALERTA_TEMPERATURA == true) {
    digitalWrite(LED_PIN, HIGH); // acende o LED quando pelo menos um alerta estiver ativo
  } else {
    digitalWrite(LED_PIN, LOW);    // apaga o LED quando nenhum alerta estiver ativo
  }

  // FUNCAO PARA O BUZZER EMITIR SOM QUANDO ALERTA ESTIVER ATIVADO
  if (ALERTA_UMIDADE == true || ALERTA_TEMPERATURA == true) {
    tone(BUZZER_PIN, 500); // ativa o buzzer em 1000 Hz quando pelo menos um alerta estiver ativo
  } else {
    noTone(BUZZER_PIN);// desativa o buzzer quando nenhum alerta estiver ativo
  }
}

// FUNCAO PARA MOSTRAR OS DADOS DOS SENSORES
void mostrarDados(
  float temperatura,
  float umidade,
  int umidadeSolo,
  int valorAnalogicoSolo
) {
  Serial.println("Temperatura:");
  Serial.println(temperatura);
  Serial.println(" C");

  Serial.println("Umidade do ar:");
  Serial.println(umidade);
  Serial.println(" %");

  Serial.println("Umidade do solo:");
  Serial.println(umidadeSolo);
  Serial.println(" %");

  Serial.print("Valor analogico do solo: ");
  Serial.println(valorAnalogicoSolo);  // mostra o valor bruto do ADC

  Serial.println("-----");

}

// FUNCAO PARA VERIFICAR SE OS DADOS DEVEM SER PUBLICADOS NO THINGSPEAK
bool verificarPublicacao(
  float temperatura,
  float umidade,
  int umidadeSolo
) {

  // PRIMEIRA PUBLICACAO
  if (primeiraPublicacao) {
    Serial.println("Primeira publicacao obrigatoria.");
    return true; // na primeira leitura os tres valores sao publicados independentemente da variacao
  }

  // VERIFICACAO DA TEMPERATURA
  if (
    fabs(temperatura - ultimaTemperaturaPublicada) >= VARIACAO_TEMPERATURA) { // fabs calcula a diferenca absoluta entre os valores
    Serial.println("Variacao suficiente na temperatura.");
    return true;
    // tanto o aumento quanto a diminuicao de pelo menos
    // 1 grau causam uma nova publicacao
  }

  // VERIFICACAO DA UMIDADE DO AR
  if (
    fabs(umidade - ultimaUmidadePublicada) >= VARIACAO_UMIDADE_AR) { // fabs calcula a diferenca absoluta entre os valores
    Serial.println("Variacao suficiente na umidade do ar.");
    return true;
    // tanto o aumento quanto a diminuicao de pelo menos
    // 3% na umidade do ar causam uma nova publicacao

  }

  // VERIFICACAO DA UMIDADE DO SOLO
  if (
    abs(umidadeSolo - ultimaUmidadeSoloPublicada) >= VARIACAO_UMIDADE_SOLO) { // fabs calcula a diferenca absoluta entre os valores
    Serial.println("Variacao suficiente na umidade do solo.");
    return true;
    // tanto o aumento quanto a diminuicao de pelo menos
    // 5% na umidade do solo causam uma nova publicacao

  }

  // NENHUM SENSOR ATINGIU A VARIACAO MINIMA
  return false; // se nenhum sensor atingir sua variacao minima nenhum dado sera enviado
}

// FUNCAO PARA PUBLICAR OS DADOS NO THINGSPEAK
void publicarDados(float temperatura, float umidade, int umidadeSolo) {

  // VERIFICACAO DO INTERVALO ENTRE PUBLICACOES
  unsigned long agora = millis();

  if (
    primeiraPublicacao == false && agora - ultimaPublicacao < INTERVALO_PUBLICACAO) {
    Serial.println(
      "Aguardando intervalo minimo para publicar no ThingSpeak."
    );
    return;
    // evita publicar antes de completar 16 segundos
    // desde a ultima publicacao bem-sucedida
  }


  // ==========================================================
  // MONTAGEM DO PAYLOAD
  // ==========================================================

  char payload[150];
  // cria uma variavel para armazenar a mensagem
  // que sera enviada para o ThingSpeak

  snprintf(
    payload, sizeof(payload), "field1=%.2f&field2=%.2f&field3=%d", temperatura, umidade, umidadeSolo);
  // monta a mensagem que sera enviada
  // field1 = temperatura do DHT11
  // field2 = umidade do ar do DHT11
  // field3 = umidade do solo
  // %.2f significa que o numero sera enviado
  // com duas casas decimais
  // %d envia um numero inteiro

  // MONTAGEM DO TOPICO MQTT
  String topico = "channels/" + String(channelID) + "/publish";
  // cria o topico MQTT usando o numero do canal
  // do ThingSpeak

  // ENVIO DOS DADOS
  bool enviado = client.publish(topico.c_str(),payload);
  // envia a mensagem para o ThingSpeak
  // c_str() converte a String para o formato de texto necessario para a funcao publish()
  // enviado informa se a biblioteca conseguiu publicar a mensagem no MQTT

  // ATUALIZA OS ULTIMOS VALORES PUBLICADOS
  if (enviado) {
    Serial.print("Publicado no ThingSpeak: ");
    Serial.println(payload);

    ultimaTemperaturaPublicada = temperatura;
    ultimaUmidadePublicada = umidade;
    ultimaUmidadeSoloPublicada = umidadeSolo;
    // atualiza os valores de referencia somente quando a mensagem foi publicada com sucesso

    primeiraPublicacao = false;
    // informa que a primeira publicacao ja aconteceu

    ultimaPublicacao = millis();
    // guarda o instante da ultima publicacao bem-sucedida

    Serial.println("Dados atualizados no ThingSpeak.");
  } else {
    Serial.println("Falha ao publicar no ThingSpeak!");
    // se a publicacao falhar, os valores de referencia nao serao atualizados
    // assim a proxima leitura podera tentar publicar novamente
  }
}

// SETUP PARA INICIAR A ESP32 E AS CONEXOES
void setup() {
  Serial.begin(115200); // inicia a comunicacao com o Monitor Serial

  pinMode(BUZZER_PIN, OUTPUT); // configura o pino do buzzer como saida
  noTone(BUZZER_PIN); // garante que o buzzer inicia desligado

  pinMode(LED_PIN, OUTPUT); // configura o pino do LED como saida
  digitalWrite(LED_PIN, LOW); // inicia o LED apagado

  dht.begin(); // inicia a biblioteca do sensor DHT11

  analogSetAttenuation(ADC_11db);
  // configura a atenuacao do ADC
  // permite utilizar uma faixa maior de tensao na leitura analogica

  conectarWiFi(); // chama a funcao que conecta a ESP32 ao WiFi
  client.setServer(mqttServer, mqttPort); // informa ao cliente MQTT qual servidor e porta devem ser usados
}

// LOOP PRINCIPAL
void loop() {
  // VERIFICA SE O WIFI CONTINUA CONECTADO
  if (WiFi.status() != WL_CONNECTED) { // se o WiFi cair, tenta conectar novament
    conectarWiFi();
  }
  // VERIFICA SE O MQTT CONTINUA CONECTADO
  if (!client.connected()) { // se a conexao MQTT cair, tenta conectar novamente
    conectarMQTT();
  }
  client.loop(); // mantem a comunicacao MQTT funcionando

  // LEITURA DOS DADOS DO SENSOR DHT11
  float temperatura = dht.readTemperature(); // faz a leitura da temperatura em graus Celsius
  float umidade = dht.readHumidity(); // faz a leitura da umidade do ar em porcentagem

  // LEITURA DO SENSOR DE UMIDADE DO SOLO
  int valorAnalogicoSolo = analogRead(SOLO_SENSOR);

  // CONVERSAO DA LEITURA ANALOGICA PARA PORCENTAGEM
  int umidadeSolo = map(valorAnalogicoSolo, SOLO_SECO, SOLO_MOLHADO, 0, 100);

  //LIMITA O VALOR ENTRE 0% E 100%
  umidadeSolo = constrain (umidadeSolo, 0, 100);

  // FUNCAO PARA VALIDACAO DOS DADOS DO DHT11
  if (
    isnan(umidade) || isnan(temperatura) || (temperatura == 0 && umidade == 0) ) { 
    // isnan verifica se o valor recebido nao e um numero valido
    // tambem verifica se temperatura e umidade nao sao simultaneamente iguais a zero
    Serial.println("Falha ao ler dados do sensor DHT11!");
    Serial.println("Leitura do solo:");
    Serial.println(valorAnalogicoSolo);
    Serial.println("------");

    delay(5000);
    return;
    // interrompe esta execucao do loop e volta para o inicio
  }

  // MOSTRA OS DADOS DOS SENSORES NO MONITOR SERIAL
  mostrarDados(temperatura, umidade, umidadeSolo, valorAnalogicoSolo);
  // FUNCAO PARA ATUALIZAR A TEMPERATURA MINIMA E MAXIMA
  atualizarTemperaturas(temperatura);
  // FUNCAO PARA VERIFICAR OS ALERTAS
  verificarAlertas(temperatura, umidade);
  // FUNCAO PARA VERIFICAR SE OS DADOS DEVEM SER PUBLICADOS NO THINGSPEAK
  bool publicar = verificarPublicacao(temperatura, umidade, umidadeSolo);

  // PUBLICACAO DOS DADOS NO THINGSPEAK
  if (publicar) {
    // se temperatura OU umidade do ar OU umidade do solo
    // atingirem sua variacao minima, os dados serao publicados

    publicarDados(temperatura, umidade, umidadeSolo);
  } else {
    Serial.println(
      "Sem alteracao suficiente para publicar no ThingSpeak."
    );
    // se nenhum sensor atingir sua variacao minima
    // nenhum dado sera enviado
  }
  Serial.println("================================");

  delay(5000); // espera 5 segundos antes de realizar uma nova leitura
}
