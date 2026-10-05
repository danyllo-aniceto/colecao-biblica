import { importCosmetics } from '@/lib/admin-api';
import { BulkImportModal } from './bulk-import-modal';

/** Importar itens visuais de qualquer tipo por planilha (cria os itens; as imagens se enviam depois, na edição de cada um). */
export function CosmeticsImport({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  return (
    <BulkImportModal
      title="Importar itens visuais"
      description="Crie vários itens de uma vez por planilha CSV (Excel ou Google Planilhas: Arquivo → Baixar como CSV). As imagens você envia depois, editando cada item."
      noun="item(ns)"
      templateFile="modelo-itens-visuais.csv"
      header={['Tipo', 'Nome', 'Raridade', 'Cor', 'Efeito', 'Emoji', 'Imagem', 'Animação', 'Pacote', 'Preço', 'Descrição']}
      templateRows={[
        ['Cor do nome', 'Dourado de Belém', 'Rara', '#f2c94c', '', '', '', '', '', '', 'Exclusivo do passe de Natal'],
        ['Título', 'Pastor de Belém', 'Épica', '#f2c94c', 'Cintilar', '', '', '', '', '', ''],
        ['Fundo de perfil', 'Noite em Belém', 'Épica', '#1b2a5c', '', '', '', '', '', '', ''],
        ['Reação', 'Estrela de Belém', 'Comum', '', '', '⭐', '', 'Girar', 'Noite de Belém', '', ''],
      ]}
      aliases={{
        tipo: 'type',
        nome: 'name',
        raridade: 'rarity',
        cor: 'color',
        efeito: 'effect',
        estilo: 'effect',
        emoji: 'emoji',
        imagem: 'imageUrl',
        'link da imagem': 'imageUrl',
        animacao: 'animation',
        pacote: 'pack',
        preco: 'price',
        descricao: 'description',
      }}
      required={{ type: 'Tipo', name: 'Nome' }}
      help={
        <>
          Colunas: Tipo (Ícone, Moldura, Título, Cor do nome, Reação, Fundo de perfil ou Capa do álbum) e Nome; opcionais: Raridade, Cor (#rrggbb), Efeito (título: Simples, Brilho, Arco-íris, Pulsar, Cintilar, Onda; moldura: solid, gold, fire...), Emoji, Imagem (link), Animação, Pacote, Preço e Descrição. Com Preço o item vai para a loja; sem Preço fica só como prêmio (passe, baú...). Ícone sem imagem entra desativado até você enviar a imagem.
        </>
      }
      maxRows={300}
      run={importCosmetics}
      rowLabel={(row) => row.name}
      onClose={onClose}
      onImported={onImported}
    />
  );
}
