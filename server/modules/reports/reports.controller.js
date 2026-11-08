import * as service from './reports.service.js';
import { escapeHtml } from './reportHtml.js';

// Printable report: answers with HTML (also for errors), because it opens in a browser tab
export const serviceReport = async (req, res) => {
  try {
    const token = req.query.token || (req.headers['authorization'] || '').split(' ')[1];
    const download = req.query.download === 'true';
    const { html } = await service.serviceReportHtml(token, req.params.id, download);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    const status = error.status || 500;
    const message = status === 500 ? `Error generating the service report: ${error.message}` : error.message;
    res.status(status).send(`<h2>${escapeHtml(message)}</h2>`);
  }
};

// Filled-in report template as a PDF download
export const serviceReportPdf = async (req, res) => {
  try {
    const token = req.query.token || (req.headers['authorization'] || '').split(' ')[1];
    const { fileName, pdf } = await service.serviceReportPdf(token, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${req.query.inline === 'true' ? 'inline' : 'attachment'}; filename="${fileName.replace(/[^\w.-]/g, '_')}"`);
    res.send(pdf);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).send(`<h2>${escapeHtml(status === 500 ? `Error generating the PDF: ${error.message}` : error.message)}</h2>`);
  }
};
