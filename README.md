# ⚡ Ultimate Math — Arena das 4 Operações

Jogo educacional **3D multiplayer** (estilo Kahoot, só que numa ilha flutuante!) para praticar **adição, subtração, multiplicação e divisão** no **6º ano**.

## ✨ Recursos
- **Mundo 3D** (Three.js): ilha flutuante, símbolos matemáticos gigantes no céu, plataformas de resposta ▲ ◆ ● ■, confete e pódio.
- **Avatares personalizáveis**: 12 cores, 6 tons de pele, 9 chapéus (coroa, mago, hélice…), 4 olhos, 5 acessórios (capa, asas…).
- **8 emotes** animados (👋 💃 😂 🔥 😍 🤯 😎 😭) — botões ou teclas 1–8. No lobby, toque no chão para andar.
- **Revelação dramática**: cada personagem pula na plataforma que escolheu; quem acertou comemora, quem errou fica tonto.
- **Questões infinitas e variadas** (11 tipos): contas diretas, número que falta, decimais, ×/÷ por 10/100/1000, divisão com resto, dobro/metade, expressões numéricas, conversão de medidas, problemas do dia a dia, "qual conta está certa?" e "qual operação completa?". Distratores baseados em **erros típicos** (esquecer o vai-um, subtrair o menor do maior…).
- **"Como resolver"** passo a passo após cada questão.
- **Gamificação**: pontos por velocidade, sequência 🔥 de acertos, questões ⚡ em DOBRO, ranking e pódio.
- **Modo professor** (login): escolhe operações, dificuldade, nº de questões e tempo; vê quantos responderam, gráfico de respostas, remove jogadores e recebe **relatório da turma** (acerto por aluno e por operação, questões mais difíceis) com **download CSV**.
- **Treino solo**: 3 vidas, dificuldade progressiva e recorde salvo.
- Funciona em computador, tablet e celular. Sons sintetizados (botão 🔊).

## ▶️ Rodar localmente
```bash
npm install
npm start          # http://localhost:3000
npm test           # testa 30.000 questões geradas
```

## 🚀 Publicar no Render (onrender.com)
1. Em https://dashboard.render.com clique em **New → Blueprint** e escolha este repositório (o `render.yaml` já configura tudo).
   Ou use **New → Web Service** com Build `npm install` e Start `npm start`.
2. Compartilhe o endereço `https://SEU-APP.onrender.com` com a turma.

> No plano gratuito o servidor "dorme" após 15 min sem uso: abra o site uns 30 s antes da aula.

## 🍎 Modo professor
Na tela inicial clique em **Sou professor**. Usuário e senha podem ser trocados pelas variáveis de ambiente `TEACHER_USER` e `TEACHER_PASS` no painel do Render (recomendado se o repositório for público).

## 🎮 Como jogar
1. O professor faz login, configura e cria a sala. Aparece um **PIN** na tela (projete no quadro).
2. Os alunos abrem o site, digitam o PIN, criam o personagem e entram.
3. O professor clica **COMEÇAR**. Respostas mais rápidas valem mais pontos!
