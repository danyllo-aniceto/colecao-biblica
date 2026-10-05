# Duelo de Figurinhas — planilha de figurinhas e guia de poderes

Cada jogador monta o próprio Time de 12 figurinhas com as figurinhas que já conquistou (não há Times prontos). Painel → **Duelo de Figurinhas** → *Baixar planilha*: um CSV com **todos os personagens** (Personagem, Raridade, Papel na história, Período,
Testamento, Palavras-chave, Resumo curto) e, nos que já têm figurinha, os dados dela. Preencha da coluna **Vigor** em diante e use
*Importar planilha*: a prévia mostra os erros linha a linha antes de gravar. Linhas sem Vigor e Influência são ignoradas; uma linha
preenchida **substitui** a figurinha daquele personagem.

## Colunas

| Coluna | O que é |
|---|---|
| Personagem | nome igual ao do cadastro (acento e maiúscula não importam) |
| Vigor | custo da figurinha, de 0 a 6 |
| Influência | força da figurinha, de 0 a 30. **Preço justo sem Dom: 2 × Vigor** (1→2, 3→6, 5→10). Um Dom bom tira 1 a 3 |
| Etiquetas | até 6, separadas por vírgula: Rei, Profeta, Juiz, Apóstolo, Patriarca, Mulher, Líder, Sacerdote, Pastor, Adversário... |
| Gatilho | quando o Dom acontece (abaixo). Vazio = figurinha sem Dom |
| Efeitos | de 1 a 3 efeitos separados por ` \| ` |
| Texto do Dom | opcional: texto próprio que aparece no jogo no lugar do gerado |
| Disponível | Sim/Não (vazio = Sim). Desligada, não entra nos duelos nem nos Times |

## Gatilhos

`revelar` (quando a figurinha vira) · `continuo` (enquanto estiver em jogo; só aura, proteger e poder-por) · `fim-do-turno` ·
`fim-do-duelo` (depois do turno 6, antes de contar) · `destruida` · `aliado-jogado` (outra figurinha sua vira no mesmo cenário).

## Efeitos

Formato: `nome chave=valor chave=valor`. Sem espaços nos valores (`_` vira espaço: `inimigo-nomeado:João_Batista`).

| Efeito | Faz | Parâmetros |
|---|---|---|
| `poder` | soma/tira Influência | `valor=±N` `alvo=` si · aliados-aqui · inimigos-aqui · outros-aliados · inimigo-mais-fraco · inimigo-mais-forte · aliado-mais-fraco · inimigos-todos · mao `se=` |
| `poder-por` | Influência por cada figurinha que combine | `valor=N` `por=` aliados-aqui · aliados · inimigos-aqui · figurinhas-aqui `etiqueta=` `vigor=` |
| `comprar` | compra figurinhas | `qtd=1..3` |
| `destruir` | afasta figurinhas | `alvo=` inimigo-mais-fraco · inimigo-mais-forte · aliado-mais-fraco · todos-aqui `se=` |
| `mover-inimigos` | leva as figurinhas do rival deste cenário para outros | — |
| `calar` | cancela os Dons contínuos do rival aqui | — |
| `criar` | cria fichas | `ficha=` Descendente · Ovelha · Pão · Peixe · Soldado `onde=` cada-cenario · aqui · vizinhos |
| `sumir` | some e volta à mão depois, mais forte | `turnos=1..5` `bonus=N` |
| `proteger` | (contínuo) suas figurinhas aqui não são destruídas nem reduzidas pelo rival | — |
| `aura` | (contínuo) Influência para outras figurinhas suas | `valor=N` `em=` aliados-aqui · vizinhos · aliados `etiqueta=` |
| `devolver` | devolve uma figurinha do rival à mão dele | `alvo=` inimigo-mais-fraco · inimigo-mais-forte |
| `descartar` | o rival descarta as figurinhas de maior Vigor da mão | `qtd=1..3` |
| `vigor-extra` | mais Vigor no próximo turno | `valor=1..3` |
| `custo-menos` | as figurinhas da sua mão custam menos Vigor | `valor=1..2` |
| `converter` | a figurinha mais fraca do rival aqui passa para o seu lado | — |
| `sacrificar` | afasta sua figurinha mais fraca aqui para ganhar Influência | `ganho=N` |
| `multiplicar` | multiplica a Influência atual | `fator=2..3` |
| `mover-se` | vai para o seu cenário mais fraco com espaço | — |
| `ressuscitar` | uma figurinha afastada sua volta à mão | `qtd=1..2` |

## Condições (`se=`)

`inimigo-poder:N` · `inimigo-nomeado:Nome` · `inimigo-etiqueta:Tag` · `aliado-etiqueta:Tag` · `aliados-aqui:N` · `sozinho` ·
`perdendo` · `ganhando` · `mao-max:N` · `turno:N`.

## Exemplos (linhas da planilha)

```
Personagem;Vigor;Influência;Etiquetas;Gatilho;Efeitos;Disponível
Davi;2;2;Rei, Pastor;revelar;poder valor=+6 alvo=si se=inimigo-poder:6;Sim
Moisés;4;5;Profeta, Líder;revelar;mover-inimigos;Sim
Abraão;4;4;Patriarca;revelar;criar ficha=Descendente onde=cada-cenario;Sim
Daniel;2;2;Profeta;continuo;proteger;Sim
Jonas;1;1;Profeta;revelar;sumir turnos=3 bonus=+3;Sim
Elias;4;4;Profeta;revelar;destruir alvo=inimigo-mais-fraco;Sim
Paulo;4;5;Apóstolo;revelar;converter | poder-por valor=+1 por=aliados etiqueta=Apóstolo;Sim
```

## Regras que ajudam a equilibrar

- Nenhum Dom usa sorte: o resultado é sempre o mesmo para as mesmas jogadas.
- Dom sem condição que afeta o rival (destruir, converter, devolver) deve custar Influência.
- Figurinhas de Vigor 5 e 6 são as finalizadoras e devem ser fortes (12 a 14 de Influência no Vigor 6 só com uma desvantagem clara).
- Lançar as figurinhas em lotes (campo *Disponível*) deixa os jogadores descobrirem aos poucos.
