exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { items } = JSON.parse(event.body);
    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        items: items.map(i => ({
          title: i.name,
          unit_price: i.price,
          quantity: i.qty,
          currency_id: 'ARS'
        })),
        back_urls: {
          success: 'https://clousa.netlify.app',
          failure: 'https://clousa.netlify.app',
          pending: 'https://clousa.netlify.app'
        },
        auto_return: 'approved',
        statement_descriptor: 'CLOUSA'
      })
    });

    const data = await response.json();

    if (data.init_point) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ init_point: data.init_point })
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No se pudo crear la preferencia', detail: data })
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
