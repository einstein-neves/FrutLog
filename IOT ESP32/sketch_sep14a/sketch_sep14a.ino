// IMPORTACAO DAS BIBLIOTECAS E ETC
#include <DHT.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <stdio.h>
#include "arduino_secrets.h"

#define DHTPIN 4
#define DHTTYPE DHT11
#define BUZZER_PIN 0
#define LIMITE_TEMPERATURA 28.0

//CONFIGS DA CONEXAO WIFI
const char* ssid = SECRET_SSID;
const char* password = SECRET_PASS;

// CONFIGS DO MQQT
const char* mqttServer = "mqtt3.thingspeak.com";
const int mqttPort = 1883;
const char* mqttClientID = SECRET_MQTT_CLIENT_ID;
const char* mqttUser = SECRET_MQTT_USERNAME;
const char* mqttPass = SECRET_MQTT_PASSWORD;

unsigned long channelID = SECRET_CHANNEL_ID;

//"objetos" criados
DHT dht(DHTPIN, DHTTYPE);
WiFiClient espClient; // faz com que a esp32 seja client wifi e nao um "roteador"
PubSubClient client(espClient);

// FUNCAO PRA CONECTAR O WIFI
void conectarWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); //disconecta para evitar cache residual de conexoes antigas
  delay(100);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { //monitora o stts do wifi pra dizer no monitor serial se da algum erro
    delay(500);
    Serial.print("Status: ");
    Serial.println(WiFi.status());
  }
  Serial.println("\nWiFi conectado!");
}

// FUNCAO PRA CONECTAR AO MQTT
void conectarMQTT() {
  while (!client.connected()) { // enquanto n conectado continua rodando o loop
    Serial.println("Conectando ao MQTT do ThingSpeak...");
    if (client.connect(mqttClientID, mqttUser, mqttPass)) { // chamando os atributos da funcao conectar
      Serial.println("Conectado ao MQTT!");
    } else {
      Serial.println("Falha na conexao MQTT, tentando de novo em 5s...");
      delay(5000);
    }
  }
}

// VARIAVEIS INICIAIS DO SENSOR
float temperaturaMinima = 999;
float temperaturaMaxima = -999;
bool ALERTA_TEMPERATURA = 0;

// SETUP PARA INICIAR A ESP32 AS CONEXOES
void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT); // configura o pino do buzzer como saida 
  noTone(BUZZER_PIN); // garante que o buzzer inicia desligado
  dht.begin(); // inicia a biblioteca do sensor
  conectarWiFi();
  client.setServer(mqttServer, mqttPort);
}

// LOOP PRINCIPAL
void loop() {
  if (WiFi.status() != WL_CONNECTED) { // so pra verificar se o 
    conectarWiFi();
  }
  if (!client.connected()) {
    conectarMQTT();
  }
  client.loop();

  float temperatura = dht.readTemperature();
  float umidade = dht.readHumidity();

  // FUNCAO PARA VALIDÇÃO E FILTRAGEM DOS DADOS DO SENSOR
  if (isnan(umidade) || isnan(temperatura) || (temperatura == 0) && (umidade == 0)) {
    Serial.println("Falha ao ler dados do sensor DHT11!");
    delay (2000); //intervalo para o sensor nao ficar retornando varios erros ao msm tempo
    return;
  } else {
    char payload[100]; //char payload para o thingspeak receber 
    sprintf(payload, "field1=%.2f&field2=%.2f", temperatura, umidade); //escreve dentro da variavel
    Serial.println("Temperatura: ");
    Serial.println(temperatura);
    Serial.println(" C");
    Serial.println("Umidade:");
    Serial.println(umidade);
    Serial.println(" %");
    Serial.println("-----");

    String topico = "channels/" + String(channelID) + "/publish"; // String (com S mauisculo) é classe, não a variavel. Combinando em uma linha só, numero e texto
    client.publish(topico.c_str(), payload); //c_str = conversao de int para texto

    Serial.print("Publicado: ");
    Serial.println(payload);
    delay(16000); // ThingSpeak (plano gratuito) exige minimo de ~15s entre mensagens
  }

  // FUNCAO PARA ATUALIZAR A TEMPERATURA SEM ERRO
  // dentro do loop, depois de validar que a leitura não é nan:
  if (temperatura < temperaturaMinima) {
  temperaturaMinima = temperatura;
  }
  if (temperatura > temperaturaMaxima) {
  temperaturaMaxima = temperatura;
  }
    
    Serial.print("Minima: ");
    Serial.print(temperaturaMinima);
    Serial.print(" | Maxima: ");
    Serial.println(temperaturaMaxima);
    Serial.println("------");

  // FUNCAO PARA O ALERTA DE TEMPERATURA
  if (temperatura > LIMITE_TEMPERATURA) {
     ALERTA_TEMPERATURA = true;
     Serial.println("ALERTA: TEMPERATURA ACIMA DO PERMITIDO!!");
     Serial.println(temperatura);
     Serial.println("------");
     tone(BUZZER_PIN, 1000); // faz um som continuo de 1000 Hz no buzzer
  } else {
    ALERTA_TEMPERATURA = false;
    noTone(BUZZER_PIN); // desliga o som quando a temperatura voltar ao normal
  }

delay(5000);
}