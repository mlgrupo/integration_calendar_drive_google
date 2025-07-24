const { getDriveClient } = require('../config/googleJWT');

// Tipos comuns de MIME para filtros
const MIME_TYPES = {
  // Google Workspace
  GOOGLE_SHEET: 'application/vnd.google-apps.spreadsheet',
  GOOGLE_DOC: 'application/vnd.google-apps.document',
  GOOGLE_SLIDES: 'application/vnd.google-apps.presentation',
  GOOGLE_FOLDER: 'application/vnd.google-apps.folder',
  
  // Arquivos Office
  EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  WORD: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  POWERPOINT: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  
  // Outros formatos
  PDF: 'application/pdf',
  CSV: 'text/csv',
  JSON: 'application/json',
  IMAGE_JPEG: 'image/jpeg',
  IMAGE_PNG: 'image/png'
};

class DriveFileManager {
  constructor(userEmail) {
    this.userEmail = userEmail;
    this.drive = null;
  }

  // Inicializar o cliente do Drive (AGORA USA JWT)
  async initialize() {
    try {
      console.log(`Inicializando DriveFileManager para: ${this.userEmail} (usando JWT)`);
      
      // Usar a nova abordagem JWT
      this.drive = await getDriveClient(this.userEmail);
      
      // Testar conexão
      const about = await this.drive.about.get({
        fields: 'user,storageQuota'
      });
      
      console.log('Drive inicializado com sucesso. Usuário:', about.data.user?.emailAddress);
      return true;
    } catch (error) {
      console.error('Erro ao inicializar DriveFileManager:', error);
      throw error;
    }
  }

  // 1. LISTAR TODOS OS ARQUIVOS (AGORA USA JWT)
  async listarArquivos(opcoes = {}) {
    try {
      if (!this.drive) {
        await this.initialize();
      }

      console.log('Buscando arquivos com JWT...');
      
      const response = await this.drive.files.list({
        pageSize: opcoes.limite || 1000,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, parents, owners, shared, starred, trashed)'
      });

      let allFiles = response.data.files || [];

      // Aplicar filtros adicionais se especificados
      let filteredFiles = allFiles;
      
      if (opcoes.tipoMime) {
        filteredFiles = filteredFiles.filter(file => file.mimeType === opcoes.tipoMime);
      }
      
      if (opcoes.pasta) {
        filteredFiles = filteredFiles.filter(file => file.parents && file.parents.includes(opcoes.pasta));
      }

      if (opcoes.compartilhado) {
        filteredFiles = filteredFiles.filter(file => file.shared === true);
      }

      if (opcoes.proprietario) {
        filteredFiles = filteredFiles.filter(file => file.owners && file.owners.some(owner => owner.emailAddress === this.userEmail));
      }

      console.log(`Total de arquivos encontrados: ${filteredFiles.length}`);
      
      return filteredFiles;
    } catch (error) {
      console.error('Erro ao listar arquivos:', error);
      throw error;
    }
  }

  // 2. OBTER INFORMAÇÕES DETALHADAS DE UM ARQUIVO (AGORA USA JWT)
  async obterInfoArquivo(fileId) {
    try {
      if (!this.drive) {
        await this.initialize();
      }

      const response = await this.drive.files.get({
        fileId,
        fields: `
          id, name, mimeType, size, modifiedTime, createdTime, 
          webViewLink, webContentLink, parents, owners, 
          permissions, shared, starred, description, 
          imageMediaMetadata, videoMediaMetadata, version, md5Checksum
        `
      });

      return response.data;
    } catch (error) {
      console.error('Erro ao obter info do arquivo:', error);
      throw error;
    }
  }

  // 3. BUSCAR ARQUIVOS POR NOME OU CONTEÚDO (AGORA USA JWT)
  async buscarArquivos(termo, opcoes = {}) {
    try {
      if (!this.drive) {
        await this.initialize();
      }

      let query = `trashed=false and (name contains '${termo}'`;
      
      if (opcoes.buscarNoConteudo) {
        query += ` or fullText contains '${termo}'`;
      }
      
      query += ')';
      
      if (opcoes.tipoMime) {
        query += ` and mimeType='${opcoes.tipoMime}'`;
      }

      console.log(`Buscando arquivos com termo: ${termo}`);

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)'
      });

      const arquivos = response.data.files || [];
      console.log(`Encontrados ${arquivos.length} arquivos para o termo "${termo}"`);
      
      return arquivos;
    } catch (error) {
      console.error('Erro na busca:', error);
      throw error;
    }
  }

  // 4. OBTER ESTRUTURA DE PASTAS (AGORA USA JWT)
  async obterEstruturaPastas(pastaId = 'root', nivel = 0) {
    try {
      if (!this.drive) {
        await this.initialize();
      }

      const response = await this.drive.files.list({
        q: `'${pastaId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, parents, size, modifiedTime)'
      });

      const arquivos = response.data.files || [];
      const estrutura = [];

      for (const arquivo of arquivos) {
        const item = {
          id: arquivo.id,
          nome: arquivo.name,
          tipo: arquivo.mimeType,
          tamanho: arquivo.size,
          modificado: arquivo.modifiedTime,
          nivel,
          children: []
        };

        // Se é uma pasta, buscar recursivamente
        if (arquivo.mimeType === MIME_TYPES.GOOGLE_FOLDER) {
          item.children = await this.obterEstruturaPastas(arquivo.id, nivel + 1);
        }

        estrutura.push(item);
      }

      return estrutura;
    } catch (error) {
      console.error('Erro ao obter estrutura:', error);
      throw error;
    }
  }

  // 5. ESTATÍSTICAS E RELATÓRIOS (AGORA USA JWT)
  async obterEstatisticas() {
    try {
      if (!this.drive) {
        await this.initialize();
      }

      // Informações do usuário e quota
      const aboutResponse = await this.drive.about.get({
        fields: 'storageQuota, user'
      });

      // Contar arquivos por tipo
      const todosArquivos = await this.listarArquivos({ limite: 1000 });
      
      const estatisticas = {
        quota: aboutResponse.data.storageQuota,
        usuario: aboutResponse.data.user,
        totalArquivos: todosArquivos.length,
        tiposArquivos: {},
        tamanhoTotal: 0,
        pastas: 0,
        arquivos: 0
      };

      // Agrupar por tipo MIME
      todosArquivos.forEach(arquivo => {
        const tipo = arquivo.mimeType || 'desconhecido';
        estatisticas.tiposArquivos[tipo] = (estatisticas.tiposArquivos[tipo] || 0) + 1;
        
        if (arquivo.size) {
          estatisticas.tamanhoTotal += parseInt(arquivo.size);
        }

        if (arquivo.mimeType === MIME_TYPES.GOOGLE_FOLDER) {
          estatisticas.pastas++;
        } else {
          estatisticas.arquivos++;
        }
      });

      return estatisticas;
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      throw error;
    }
  }

  // 6. LISTAR ARQUIVOS RECENTES (AGORA USA JWT)
  async listarArquivosRecentes(dias = 7) {
    try {
      if (!this.drive) {
        await this.initialize();
      }

      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - dias);
      const dataString = dataLimite.toISOString();

      const query = `trashed=false and modifiedTime > '${dataString}'`;

      console.log(`Buscando arquivos modificados nos últimos ${dias} dias`);

      const response = await this.drive.files.list({
        q: query,
        pageSize: 1000,
        orderBy: 'modifiedTime desc',
        fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, owners)'
      });

      const arquivos = response.data.files || [];
      console.log(`Encontrados ${arquivos.length} arquivos recentes`);
      
      return arquivos;
    } catch (error) {
      console.error('Erro ao listar arquivos recentes:', error);
      throw error;
    }
  }

  // 7. LISTAR ARQUIVOS COMPARTILHADOS (AGORA USA JWT)
  async listarArquivosCompartilhados() {
    try {
      if (!this.drive) {
        await this.initialize();
      }

      const query = 'trashed=false and shared=true';

      console.log('Buscando arquivos compartilhados');

      const response = await this.drive.files.list({
        q: query,
        pageSize: 1000,
        fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, owners, permissions)'
      });

      const arquivos = response.data.files || [];
      console.log(`Encontrados ${arquivos.length} arquivos compartilhados`);
      
      return arquivos;
    } catch (error) {
      console.error('Erro ao listar arquivos compartilhados:', error);
      throw error;
    }
  }

  // 8. LISTAR ARQUIVOS POR TIPO (AGORA USA JWT)
  async listarPorTipo(tipoMime) {
    try {
      if (!this.drive) {
        await this.initialize();
      }

      console.log(`Buscando arquivos do tipo: ${tipoMime}`);

      const response = await this.drive.files.list({
        q: `mimeType='${tipoMime}' and trashed=false`,
        pageSize: 1000,
        fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, owners)'
      });

      const arquivos = response.data.files || [];
      console.log(`Encontrados ${arquivos.length} arquivos do tipo ${tipoMime}`);
      
      return arquivos;
    } catch (error) {
      console.error('Erro ao listar arquivos por tipo:', error);
      throw error;
    }
  }

  // 9. BUSCAR ARQUIVOS USANDO ADMIN SDK (AGORA USA JWT)
  async buscarComAdminSDK() {
    try {
      if (!this.drive) {
        await this.initialize();
      }

      console.log('=== BUSCANDO COM ADMIN SDK (JWT) ===');
      
      // Primeiro, vamos verificar se conseguimos acessar o Drive
      const about = await this.drive.about.get({
        fields: 'user,storageQuota'
      });
      
      console.log('Conectado como:', about.data.user?.emailAddress);
      console.log('Quota:', about.data.storageQuota);

      // Buscar todos os arquivos
      const response = await this.drive.files.list({
        pageSize: 1000,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, webViewLink, parents, owners, shared, starred, trashed)'
      });

      const arquivos = response.data.files || [];
      console.log(`Total de arquivos encontrados: ${arquivos.length}`);

      // Filtrar arquivos que pertencem ao usuário específico
      const arquivosDoUsuario = arquivos.filter(arquivo => 
        arquivo.owners && arquivo.owners.some(owner => owner.emailAddress === this.userEmail)
      );

      console.log(`Arquivos do usuário ${this.userEmail}: ${arquivosDoUsuario.length}`);

      // Mostrar alguns exemplos
      if (arquivosDoUsuario.length > 0) {
        console.log('Primeiros arquivos do usuário:');
        arquivosDoUsuario.slice(0, 5).forEach((file, index) => {
          console.log(`${index + 1}. ${file.name} (${file.mimeType}) - Shared: ${file.shared || false}`);
        });
      }

      return {
        totalArquivos: arquivos.length,
        arquivosDoUsuario: arquivosDoUsuario.length,
        arquivos: arquivosDoUsuario
      };
    } catch (error) {
      console.error('Erro ao buscar com Admin SDK:', error);
      throw error;
    }
  }

  // 10. TESTAR DIFERENTES QUERIES PARA DEBUG (AGORA USA JWT)
  async testarQueries() {
    try {
      if (!this.drive) {
        await this.initialize();
      }

      console.log('=== TESTANDO DIFERENTES QUERIES (JWT) ===');
      const resultados = {};

      // Teste 1: Query vazia (sem filtros)
      try {
        console.log('Teste 1: Query vazia (sem filtros)...');
        const response1 = await this.drive.files.list({
          pageSize: 10,
          fields: 'files(id, name, mimeType, owners)'
        });
        resultados.queryVazia = response1.data.files?.length || 0;
        console.log(`Resultado: ${resultados.queryVazia} arquivos`);
      } catch (error) {
        console.log('Erro na query vazia:', error.message);
        resultados.queryVazia = 'ERRO: ' + error.message;
      }

      // Teste 2: Arquivos próprios do usuário específico
      try {
        console.log('Teste 2: Arquivos próprios do usuário...');
        const response2 = await this.drive.files.list({
          q: `'${this.userEmail}' in owners`,
          pageSize: 10,
          fields: 'files(id, name, mimeType, owners)'
        });
        resultados.arquivosProprios = response2.data.files?.length || 0;
        console.log(`Resultado: ${resultados.arquivosProprios} arquivos`);
      } catch (error) {
        console.log('Erro nos arquivos próprios:', error.message);
        resultados.arquivosProprios = 'ERRO: ' + error.message;
      }

      // Teste 3: Arquivos compartilhados
      try {
        console.log('Teste 3: Arquivos compartilhados...');
        const response3 = await this.drive.files.list({
          q: 'sharedWithMe=true',
          pageSize: 10,
          fields: 'files(id, name, mimeType, owners)'
        });
        resultados.arquivosCompartilhados = response3.data.files?.length || 0;
        console.log(`Resultado: ${resultados.arquivosCompartilhados} arquivos`);
      } catch (error) {
        console.log('Erro nos arquivos compartilhados:', error.message);
        resultados.arquivosCompartilhados = 'ERRO: ' + error.message;
      }

      // Teste 4: Apenas trashed=false
      try {
        console.log('Teste 4: Apenas trashed=false...');
        const response4 = await this.drive.files.list({
          q: 'trashed=false',
          pageSize: 10,
          fields: 'files(id, name, mimeType, owners)'
        });
        resultados.trashedFalse = response4.data.files?.length || 0;
        console.log(`Resultado: ${resultados.trashedFalse} arquivos`);
      } catch (error) {
        console.log('Erro em trashed=false:', error.message);
        resultados.trashedFalse = 'ERRO: ' + error.message;
      }

      // Teste 5: Arquivos recentes
      try {
        console.log('Teste 5: Arquivos recentes...');
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const dateString = oneWeekAgo.toISOString();
        
        const response5 = await this.drive.files.list({
          q: `modifiedTime > '${dateString}'`,
          pageSize: 10,
          fields: 'files(id, name, mimeType, owners)'
        });
        resultados.arquivosRecentes = response5.data.files?.length || 0;
        console.log(`Resultado: ${resultados.arquivosRecentes} arquivos`);
      } catch (error) {
        console.log('Erro nos arquivos recentes:', error.message);
        resultados.arquivosRecentes = 'ERRO: ' + error.message;
      }

      return resultados;
    } catch (error) {
      console.error('Erro ao testar queries:', error);
      throw error;
    }
  }
}

module.exports = { DriveFileManager, MIME_TYPES }; 