# Duelo de Cartas — planilha de cartas e guia de poderes

Painel → **Duelo de Cartas** → *Baixar planilha*: um CSV com **todos os personagens** (Personagem, Raridade, Papel na história, Período,
Testamento, Palavras-chave, Resumo curto) e, nos que já têm carta, os dados dela. Preencha da coluna **Vigor** em diante e use
*Importar planilha*: a prévia mostra os erros linha a linha antes de gravar. Linhas sem Vigor e Influência são ignoradas; uma linha
preenchida **substitui** a carta daquele personagem.

## Colunas

| Coluna | O que é |
|---|---|
| Personagem | nome igual ao do cadastro (acento e maiúscula não importam) |
| Vigor | custo da carta, de 0 a 6 |
| Influência | força da carta, de 0 a 30. **Preço justo sem Dom: 2 × Vigor** (1→2, 3→6, 5→10). Um Dom bom tira 1 a 3 |
| Etiquetas | até 6, separadas por vírgula: Rei, Profeta, Juiz, Apóstolo, Patriarca, Mulher, Líder, Sacerdote, Pastor, Adversário... |
| Gatilho | quando o Dom acontece (abaixo). Vazio = carta sem Dom |
| Efeitos | de 1 a 3 efeitos separados por ` \| ` |
| Texto do Dom | opcional: texto próprio que aparece no jogo no lugar do gerado |
| Disponível | Sim/Não (vazio = Sim). Desligada, não entra nos duelos nem nos Times |
| Times | nomes dos Times prontos de que a carta faz parte, separados por vírgula. **Um Time só aparece no jogo com exatamente 12 cartas disponíveis** |

## Gatilhos

`revelar` (quando a carta vira) · `continuo` (enquanto estiver em jogo; só aura, proteger e poder-por) · `fim-do-turno` ·
`fim-do-duelo` (depois do turno 6, antes de contar) · `destruida` · `aliado-jogado` (outra carta sua vira no mesmo cenário).

## Efeitos

Formato: `nome chave=valor chave=valor`. Sem espaços nos valores (`_` vira espaço: `inimigo-nomeado:João_Batista`).

| Efeito | Faz | Parâmetros |
|---|---|---|
| `poder` | soma/tira Influência | `valor=±N` `alvo=` si · aliados-aqui · inimigos-aqui · outros-aliados · inimigo-mais-fraco · inimigo-mais-forte · aliado-mais-fraco · inimigos-todos · mao `se=` |
| `poder-por` | Influência por cada carta que combine | `valor=N` `por=` aliados-aqui · aliados · inimigos-aqui · cartas-aqui `etiqueta=` `vigor=` |
| `comprar` | compra cartas | `qtd=1..3` |
| `destruir` | afasta cartas | `alvo=` inimigo-mais-fraco · inimigo-mais-forte · aliado-mais-fraco · todos-aqui `se=` |
| `mover-inimigos` | leva as cartas do rival deste cenário para outros | — |
| `calar` | cancela os Dons contínuos do rival aqui | — |
| `criar` | cria fichas | `ficha=` Descendente · Ovelha · Pão · Peixe · Soldado `onde=` cada-cenario · aqui · vizinhos |
| `sumir` | some e volta à mão depois, mais forte | `turnos=1..5` `bonus=N` |
| `proteger` | (contínuo) suas cartas aqui não são destruídas nem reduzidas pelo rival | — |
| `aura` | (contínuo) Influência para outras cartas suas | `valor=N` `em=` aliados-aqui · vizinhos · aliados `etiqueta=` |
| `devolver` | devolve uma carta do rival à mão dele | `alvo=` inimigo-mais-fraco · inimigo-mais-forte |
| `descartar` | o rival descarta as cartas de maior Vigor da mão | `qtd=1..3` |
| `vigor-extra` | mais Vigor no próximo turno | `valor=1..3` |
| `custo-menos` | as cartas da sua mão custam menos Vigor | `valor=1..2` |
| `converter` | a carta mais fraca do rival aqui passa para o seu lado | — |
| `sacrificar` | afasta sua carta mais fraca aqui para ganhar Influência | `ganho=N` |
| `multiplicar` | multiplica a Influência atual | `fator=2..3` |
| `mover-se` | vai para o seu cenário mais fraco com espaço | — |
| `ressuscitar` | uma carta afastada sua volta à mão | `qtd=1..2` |

## Condições (`se=`)

`inimigo-poder:N` · `inimigo-nomeado:Nome` · `inimigo-etiqueta:Tag` · `aliado-etiqueta:Tag` · `aliados-aqui:N` · `sozinho` ·
`perdendo` · `ganhando` · `mao-max:N` · `turno:N`.

## Exemplos (linhas da planilha)

```
Personagem;Vigor;Influência;Etiquetas;Gatilho;Efeitos;Disponível;Times
Davi;2;2;Rei, Pastor;revelar;poder valor=+6 alvo=si se=inimigo-poder:6;Sim;Reis e Juízes
Moisés;4;5;Profeta, Líder;revelar;mover-inimigos;Sim;Profetas e Patriarcas
Abraão;4;4;Patriarca;revelar;criar ficha=Descendente onde=cada-cenario;Sim;Profetas e Patriarcas
Daniel;2;2;Profeta;continuo;proteger;Sim;
Jonas;1;1;Profeta;revelar;sumir turnos=3 bonus=+3;Sim;
Elias;4;4;Profeta;revelar;destruir alvo=inimigo-mais-fraco;Sim;
Paulo;4;5;Apóstolo;revelar;converter | poder-por valor=+1 por=aliados etiqueta=Apóstolo;Sim;
```

## Regras que ajudam a equilibrar

- Nenhum Dom usa sorte: o resultado é sempre o mesmo para as mesmas jogadas.
- Dom sem condição que afeta o rival (destruir, converter, devolver) deve custar Influência.
- Cartas de Vigor 5 e 6 são as finalizadoras e devem ser fortes (12 a 14 de Influência no Vigor 6 só com uma desvantagem clara).
- Lançar as cartas em lotes (campo *Disponível*) deixa os jogadores descobrirem aos poucos.
