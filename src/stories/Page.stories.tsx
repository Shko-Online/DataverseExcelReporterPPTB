import type { Meta, StoryObj } from '@storybook/react-vite';

import App from '../App';
import { ToolboxAPIProvider } from '../context/ToolboxAPIContext';
import { DataverseAPIProvider } from '../context/DataverseAPIContext';
import { ConnectionProvider } from '../context/ConnectionContext';
import { ApplicationDataProvider } from '../context/ApplicationDataContext';
import './mockPPTB';

const WrappedApp = () => (
    <ToolboxAPIProvider>
        <DataverseAPIProvider>
            <ConnectionProvider>
                <ApplicationDataProvider>
                    <App />
                </ApplicationDataProvider>
            </ConnectionProvider>
        </DataverseAPIProvider>
    </ToolboxAPIProvider>
);


const meta = {
    title: 'Full Tool',
    component: WrappedApp,
    parameters: {
        // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
        layout: 'fullscreen',
    },
} satisfies Meta<typeof WrappedApp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullTool: Story = {};

// // More on component testing: https://storybook.js.org/docs/writing-tests/interaction-testing
// export const LoggedIn: Story = {
//   play: async ({ canvasElement }) => {
//     const canvas = within(canvasElement);
//     const loginButton = canvas.getByRole('button', { name: /Log in/i });
//     await expect(loginButton).toBeInTheDocument();
//     await userEvent.click(loginButton);
//     await expect(loginButton).not.toBeInTheDocument();

//     const logoutButton = canvas.getByRole('button', { name: /Log out/i });
//     await expect(logoutButton).toBeInTheDocument();
//   },
// };
