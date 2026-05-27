# Usa a versão leve do Node.js 20
FROM node:20-alpine

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala as dependências da aplicação
RUN npm install

# Copia o restante dos arquivos do projeto
COPY . .

# Expõe a porta em que a aplicação vai rodar
EXPOSE 3000

# Executa o servidor de desenvolvimento do Vite
CMD ["npm", "run", "dev"]