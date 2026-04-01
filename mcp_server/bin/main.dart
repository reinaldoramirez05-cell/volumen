import 'dart:convert';
import 'dart:io';

void main() async {
  // Use stderr for logging, stdout is reserved for MCP messages
  stderr.writeln("Volumen MCP Server starting...");

  stdin
      .transform(utf8.decoder)
      .transform(const LineSplitter())
      .listen((line) {
    if (line.trim().isEmpty) return;
    try {
      final request = jsonDecode(line) as Map<String, dynamic>;
      handleRequest(request);
    } catch (e) {
      stderr.writeln("Error parsing request: $e");
    }
  });
}

Future<void> handleRequest(Map<String, dynamic> request) async {
  final method = request['method'];
  final id = request['id'];

  if (method == 'initialize') {
    sendResponse(id, {
      'protocolVersion': '2024-11-05',
      'capabilities': {
        'tools': {},
        'resources': {},
      },
      'serverInfo': {
        'name': 'volumen-mcp',
        'version': '1.0.0',
      }
    });
  } else if (method == 'tools/list') {
    sendResponse(id, {
      'tools': [
        {
          'name': 'analyze_magazine_content',
          'description': 'Analyzes the Volumen magazine HTML files for consistency and bilingual structure.',
          'inputSchema': {
            'type': 'object',
            'properties': {
              'filePath': {
                'type': 'string',
                'description': 'The relative path to the HTML file (e.g. index.html)'
              }
            },
            'required': ['filePath']
          },
        },
        {
          'name': 'get_bilingual_dictionary',
          'description': 'Returns common terms and their translations used in the Volumen project.',
          'inputSchema': {
            'type': 'object',
            'properties': {},
          },
        }
      ]
    });
  } else if (method == 'tools/call') {
    final params = request['params'] as Map<String, dynamic>;
    final name = params['name'];
    final args = params['arguments'] as Map<String, dynamic>? ?? {};

    if (name == 'analyze_magazine_content') {
      final filePath = args['filePath'] as String;
      final result = await analyzeContent(filePath);
      sendResponse(id, {
        'content': [
          {
            'type': 'text',
            'text': result
          }
        ]
      });
    } else if (name == 'get_bilingual_dictionary') {
      sendResponse(id, {
        'content': [
          {
            'type': 'text',
            'text': 'Dictionary:\n- Latin Rock: Rock Latino\n- Volume: Volumen\n- Issue: Edicin\n- Editorial: Editorial'
          }
        ]
      });
    }
  } else if (method == 'notifications/initialized') {
    // No response needed
  } else {
    // Handle other methods or ignore
  }
}

Future<String> analyzeContent(String filePath) async {
  try {
    final file = File('../$filePath'); // Assuming we run from mcp_server/bin
    if (!await file.exists()) {
      return "File not found: $filePath";
    }
    final content = await file.readAsString();
    
    // Simple analysis
    final hasEnglish = content.contains('lang="en"');
    final hasSpanish = content.contains('lang="es"') || content.contains('Rock Latino');
    final articleCount = RegExp(r'class="[^"]*article[^"]*"').allMatches(content).length;

    return "Analysis of $filePath:\n- Bilingual Support: ${hasEnglish ? 'English detected' : 'English missing'}, ${hasSpanish ? 'Spanish detected' : 'Spanish missing'}\n- Approximate Articles found: $articleCount";
  } catch (e) {
    return "Error analyzing file: $e";
  }
}

void sendResponse(dynamic id, dynamic result) {
  final response = {
    'jsonrpc': '2.0',
    'id': id,
    'result': result,
  };
  stdout.writeln(jsonEncode(response));
}
