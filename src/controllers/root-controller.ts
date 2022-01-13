import { Request, Response, Router } from 'express';
import router from 'express-promise-router';
import fetch from 'node-fetch';

import { Env } from '../services';
import { Controller } from './controller';

export class RootController implements Controller {
    public path = '/';
    public router: Router = router();

    public register(): void {
        this.router.get('/', (req, res) => this.get(req, res));
        this.router.post('/webhooks/thrive', (req, res) => this.thriveWebhook(req, res));
    }

    private async get(req: Request, res: Response): Promise<void> {
        res.status(200).json({ name: 'Discord Bot Cluster API', author: 'Kiril Kartunov' });
    }

    /**
     * Thrive webhook listener
     * Acts upon Contentful webhooks
     */
    private async thriveWebhook(req: Request, res: Response): Promise<void> {
        if (req.body.sys.revision === 1) {
            const res = await fetch(Env.discordThriveWebhook, {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: `Hey, we have published a new article on Thrive. Have a look at it https://www.topcoder.com/thrive/articles/${req.body.fields.slug['en-US']}`
                }),
            });
        }
        res.status(200).end();
    }
}
